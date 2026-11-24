"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteImages, putImage } from "@/lib/blob-store";
import { getCurrentUser } from "@/lib/current-user";
import { readJpegUpload } from "@/lib/image-file";
import { validatePaymentAccount } from "@/lib/payment-input";
import type { AccountFormState, AccountFormValues, PaymentDeleteState } from "@/lib/payment-form-state";
import {
  createPaymentAccount,
  deletePaymentAccount,
  updatePaymentAccount,
  type QrChange,
} from "@/lib/payments";

// Only these named fields are ever read from the form: kind, bankName, accountName, number,
// the qr file, qrAction (keep, replace or remove) and the account id. Who may change an account
// is decided inside the database query (it must be the person's own), not here.
//
// Order of work with a picture: the new file is uploaded first, then the account is written; if
// the write fails or is refused, the new file is deleted again. An old file is deleted only
// after the write worked. A file left behind by a crash is harmless; a lost one is not.

const ACCOUNTS = "/profile";
const SAVE_FAILED = "Couldn't save these details. Please try again.";
const UPLOAD_FAILED = "Couldn't upload that image. Please try again.";
const DELETE_FAILED = "Couldn't delete these details. Please try again.";
const TOO_MANY = "You can save up to 10 payment accounts. Delete one first.";

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readValues(formData: FormData): AccountFormValues {
  return {
    kind: readText(formData, "kind"),
    bankName: readText(formData, "bankName"),
    accountName: readText(formData, "accountName"),
    number: readText(formData, "number"),
  };
}

export async function savePaymentAccountAction(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await getCurrentUser(); // never trust the client: re-check the session

  const values = readValues(formData);
  const accountId = readText(formData, "accountId");
  const editing = accountId !== "";
  const qrAction = readText(formData, "qrAction");

  const result = validatePaymentAccount(values);

  // A picture to store: only when asked to replace (or add) one.
  let uploaded: Uint8Array | null = null;
  const errors: AccountFormState["errors"] = result.ok ? {} : { ...result.errors };
  if (qrAction === "replace") {
    const upload = await readJpegUpload(formData.get("qr"));
    if (upload.ok) uploaded = upload.bytes;
    else errors.qr = upload.error;
  }
  if (!result.ok || errors.qr) return { errors, values };

  let newPath: string | null = null;
  if (uploaded) {
    try {
      newPath = await putImage("qr", uploaded);
    } catch {
      return { errors: { qr: UPLOAD_FAILED }, values };
    }
  }

  let oldPath: string | null = null;
  let outcome: "ok" | "too-many" | "not-found";
  try {
    if (editing) {
      const qr: QrChange = newPath
        ? { mode: "replace", path: newPath }
        : qrAction === "remove"
          ? { mode: "remove" }
          : { mode: "keep" };
      const updated = await updatePaymentAccount(user.id, accountId, result.value, qr);
      if (updated === "not-found") outcome = "not-found";
      else {
        outcome = "ok";
        oldPath = updated.oldQrPath;
      }
    } else {
      outcome = await createPaymentAccount(user.id, result.value, newPath);
    }
  } catch {
    if (newPath) await deleteImages([newPath]);
    return { errors: { form: SAVE_FAILED }, values };
  }

  if (outcome !== "ok") {
    if (newPath) await deleteImages([newPath]);
    if (outcome === "too-many") return { errors: { form: TOO_MANY }, values };
    redirect(ACCOUNTS); // not the person's account (or gone): same as a missing one
  }

  if (oldPath) await deleteImages([oldPath]);
  revalidatePath(ACCOUNTS);
  redirect(ACCOUNTS); // redirect works by throwing: keep it outside try/catch
}

export async function deletePaymentAccountAction(
  _prev: PaymentDeleteState,
  formData: FormData,
): Promise<PaymentDeleteState> {
  const user = await getCurrentUser();

  const accountId = readText(formData, "accountId");
  if (accountId === "") redirect(ACCOUNTS);

  let qrPath: string | null = null;
  try {
    const deleted = await deletePaymentAccount(user.id, accountId);
    if (deleted !== "not-found") qrPath = deleted.qrPath;
  } catch {
    return { error: DELETE_FAILED };
  }

  if (qrPath) await deleteImages([qrPath]);
  revalidatePath(ACCOUNTS);
  redirect(ACCOUNTS);
}
