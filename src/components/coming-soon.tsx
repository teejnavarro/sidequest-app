import { cardClass, screenClass } from "@/components/ui";

// Honest placeholder for a tab whose feature has not been built yet.
export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <main className={`${screenClass} flex-1`}>
      <section className={`${cardClass} gap-2 px-5 py-6`}>
        <h2 className="text-[19px]">{title}</h2>
        <p>{text}</p>
        <p className="text-[13px] text-muted">Coming soon.</p>
      </section>
    </main>
  );
}
