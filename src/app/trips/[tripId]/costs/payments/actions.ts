"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteImages, putImage } from "@/lib/blob-store";
import { getCurrentUser } from "@/lib/current-user";
import { readJpegUpload } from "@/lib/image-file";
import { validatePaymentRecord } from "@/lib/payment-input";
import type { PayFormState, PayFormValues, PaymentDeleteState } from "@/lib/payment-form-state";
import { deletePayment, getPayPageForMember, recordPayment } from "@/lib/payments";

// Only these named fields are ever read from the form: the trip id, the payment id (made by
// the form, so a double tap saves once), the two spots, amount, method and the receipt file.
// The ids only say WHICH trip or spot: who may record or delete is decided inside the database
// query. The amount cap is never taken from the form: Save loads the balances again.
//
// With a receipt the file is uploaded first and the payment written second; a file that did not
// end up on a saved payment (refused, repeated or failed) is deleted again.
function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const PAYMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const balancesAddress = (tripId: string) => `/trips/${tripId}/costs/balances`;
const SAVE_FAILED = "Couldn't save the payment. Please try again.";
const UPLOAD_FAILED = "Couldn't upload that image. Please try again.";
const DELETE_FAILED = "Couldn't delete the payment. Please try again.";

function refresh(tripId: string) {
  revalidatePath(balancesAddress(tripId));
  revalidatePath(`/trips/${tripId}/costs`);
  revalidatePath("/trips");
}

export async function recordPaymentAction(
  _prev: PayFormState,
  formData: FormData,
): Promise<PayFormState> {
  const user = await getCurrentUser(); // never trust the client: re-check the session

  const tripId = readText(formData, "tripId");
  if (tripId === "") redirect("/trips");
  const paymentId = readText(formData, "paymentId");
  const fromSpot = readText(formData, "fromSpot");
  const toSpot = readText(formData, "toSpot");
  if (!PAYMENT_ID.test(paymentId) || fromSpot === "" || toSpot === "") redirect(balancesAddress(tripId));

  const values: PayFormValues = { amount: readText(formData, "amount"), method: readText(formData, "method") };

  // The line as it is right now, and whether this person may record it.
  let page: Awaited<ReturnType<typeof getPayPageForMember>>;
  try {
    page = await getPayPageForMember(tripId, fromSpot, toSpot, user.id);
  } catch {
    return { errors: { form: SAVE_FAILED }, values };
  }
  if (!page || !page.canRecord) redirect(balancesAddress(tripId)); // gone, or not theirs

  const result = validatePaymentRecord(values, {
    currency: page.currency,
    maxAmount: page.amount,
    payerName: page.from.name,
    receiverName: page.to.name,
  });
  const errors: PayFormState["errors"] = result.ok ? {} : { ...result.errors };

  let receipt: Uint8Array | null = null;
  const file = formData.get("receipt");
  if (file instanceof File && file.size > 0) {
    const upload = await readJpegUpload(file);
    if (upload.ok) receipt = upload.bytes;
    else errors.receipt = upload.error;
  }
  if (!result.ok || errors.receipt) return { errors, values };

  let receiptPath: string | null = null;
  if (receipt) {
    try {
      receiptPath = await putImage("receipts", receipt);
    } catch {
      return { errors: { receipt: UPLOAD_FAILED }, values };
    }
  }

  let outcome: "ok" | "repeat" | "not-allowed";
  try {
    outcome = await recordPayment({
      tripId,
      paymentId,
      fromSpot,
      toSpot,
      amount: result.value.amount,
      method: result.value.method,
      receiptPath,
      userId: user.id,
    });
  } catch {
    if (receiptPath) await deleteImages([receiptPath]);
    return { errors: { form: SAVE_FAILED }, values };
  }

  if (outcome !== "ok" && receiptPath) await deleteImages([receiptPath]);
  if (outcome !== "not-allowed") refresh(tripId);
  redirect(balancesAddress(tripId)); // redirect works by throwing: keep it outside try/catch
}

export async function deletePaymentAction(
  _prev: PaymentDeleteState,
  formData: FormData,
): Promise<PaymentDeleteState> {
  const user = await getCurrentUser();

  const tripId = readText(formData, "tripId");
  const paymentId = readText(formData, "paymentId");
  if (tripId === "") redirect("/trips");
  if (paymentId === "") redirect(balancesAddress(tripId));

  let receiptPath: string | null = null;
  try {
    const deleted = await deletePayment(tripId, paymentId, user.id);
    if (deleted !== "not-found") receiptPath = deleted.receiptPath;
  } catch {
    return { error: DELETE_FAILED };
  }

  if (receiptPath) await deleteImages([receiptPath]);
  refresh(tripId);
  redirect(balancesAddress(tripId));
}
