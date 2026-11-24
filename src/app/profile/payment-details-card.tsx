import Link from "next/link";
import { Bank, CaretRight, DeviceMobile, Plus } from "@phosphor-icons/react/dist/ssr";
import { cardClass, helpClass, quietButton } from "@/components/ui";
import { accountLabel, formatAccountNumber, lastFour } from "@/lib/payment-input";
import { listMyPaymentAccounts, type PaymentAccountView } from "@/lib/payments";
import { MAX_PAYMENT_ACCOUNTS } from "@/lib/payment-form-state";

// One saved account: icon, label, and a quiet line with the number, the name on the account
// and "QR added". A bank number shows only its last four here (the full one is on Edit).
function AccountRow({ account }: { account: PaymentAccountView }) {
  const Icon = account.kind === "bank" ? Bank : DeviceMobile;
  const number =
    account.kind === "bank" ? `•••• ${lastFour(account.number)}` : formatAccountNumber(account.kind, account.number);
  const line = [number, account.accountName, account.hasQr ? "QR added" : null].filter(Boolean).join(" · ");
  return (
    <li className="border-t border-line first:border-t-0">
      <Link
        href={`/profile/payment-details/${account.id}/edit`}
        className="flex min-h-14 min-w-0 items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-text"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-soft text-blue-text">
          <Icon size={22} weight="bold" aria-hidden="true" />
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="text-[15px] font-bold wrap-anywhere">{accountLabel(account)}</span>
          <span className="text-sm text-muted wrap-anywhere">{line}</span>
        </span>
        <CaretRight size={18} weight="bold" aria-hidden="true" className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}

// The "Payment details" card on Profile: what friends in your trips see when they pay you back.
export async function PaymentDetailsCard({ userId }: { userId: string }) {
  const accounts = await listMyPaymentAccounts(userId);
  return (
    <section className={`${cardClass} gap-3 px-5 py-4`} aria-label="Payment details">
      <div>
        <h2 className="text-[19px]">Payment details</h2>
        <p className={helpClass}>
          Friends in your trips see these when they pay you back. Only add where you receive money. Never card
          numbers, PINs or codes.
        </p>
      </div>
      {accounts.length === 0 ? (
        <p>Add your GCash, Maya or bank details so friends can pay you back without asking.</p>
      ) : (
        <ul>
          {accounts.map((account) => (
            <AccountRow key={account.id} account={account} />
          ))}
        </ul>
      )}
      {accounts.length < MAX_PAYMENT_ACCOUNTS ? (
        <Link href="/profile/payment-details/new" className={`${quietButton} w-full`}>
          <Plus size={20} weight="bold" aria-hidden="true" />
          Add payment details
        </Link>
      ) : null}
    </section>
  );
}
