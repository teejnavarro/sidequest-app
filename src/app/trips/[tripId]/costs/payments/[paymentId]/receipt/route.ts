import { readImage } from "@/lib/blob-store";
import { getCurrentUser } from "@/lib/current-user";
import { imageResponse, notFoundResponse } from "@/lib/image-response";
import { getReceiptForParty } from "@/lib/payments";

// A payment's receipt. Only the payer and the receiver (while still in the trip) get the
// picture; a third member, a stranger and a missing file all get the same "not found".
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; paymentId: string }> },
) {
  const { tripId, paymentId } = await params;
  const user = await getCurrentUser();
  const path = await getReceiptForParty(tripId, paymentId, user.id);
  if (!path) return notFoundResponse();
  const image = await readImage(path);
  if (!image) return notFoundResponse();
  return imageResponse(image.stream);
}
