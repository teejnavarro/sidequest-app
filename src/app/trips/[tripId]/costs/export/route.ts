import { getCurrentUser } from "@/lib/current-user";
import { listCostsForExport } from "@/lib/costs";
import { buildCostsCsv, csvFileName } from "@/lib/costs-csv";

// The spreadsheet download. Members only: anyone else gets the same "not found" as a missing trip.
export async function GET(_request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await getCurrentUser();
  const data = await listCostsForExport(tripId, user.id);
  if (!data) return new Response("Not found", { status: 404 });

  const fileName = csvFileName(data.tripName);
  return new Response(buildCostsCsv(data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
