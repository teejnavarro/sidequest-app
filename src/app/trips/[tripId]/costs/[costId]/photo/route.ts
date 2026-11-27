import { readImage } from "@/lib/blob-store";
import { getCostPhotoForMember } from "@/lib/costs";
import { getCurrentUser } from "@/lib/current-user";
import { imageResponse, notFoundResponse } from "@/lib/image-response";

// A cost's receipt photo. Only someone still in the trip gets the picture; a stranger, a person
// who left, a trashed or unknown cost and a missing file all get the same "not found".
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; costId: string }> },
) {
  const { tripId, costId } = await params;
  const user = await getCurrentUser();
  const path = await getCostPhotoForMember(tripId, costId, user.id);
  if (!path) return notFoundResponse();
  const image = await readImage(path);
  if (!image) return notFoundResponse();
  return imageResponse(image.stream);
}
