import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { getInvoiceById } from "@/lib/data";
import { NotFoundError } from "@/core/errors";
import { ApiError } from "@/core/api/errors";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 5 — `GET /api/v1/invoices/:id`. `finance.read` scope. */
export const GET = createApiHandler<{ id: string }>("finance.read", async (_request, _auth, { id }): Promise<NextResponse> => {
  try {
    const invoice = await getInvoiceById(id);
    return apiSuccess(invoice);
  } catch (error) {
    if (error instanceof NotFoundError) throw new ApiError("not_found", `No invoice with id "${id}" was found.`);
    throw error;
  }
});
