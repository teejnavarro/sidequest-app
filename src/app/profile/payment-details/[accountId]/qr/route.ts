import { readImage } from "@/lib/blob-store";
import { getCurrentUser } from "@/lib/current-user";
import { imageResponse, notFoundResponse } from "@/lib/image-response";
import { getQrForViewer } from "@/lib/payments";

// A saved QR image. The person who saved it and anyone in a trip with them right now get the
// picture; everyone else gets the same "not found" as a missing account.
export async function GET(_request: Request, { params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const user = await getCurrentUser();
  const path = await getQrForViewer(accountId, user.id);
  if (!path) return notFoundResponse();
  const image = await readImage(path);
  if (!image) return notFoundResponse();
  return imageResponse(image.stream);
}
