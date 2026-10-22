/**
 * Seed of the dummy return bills, used while the backend of the
 * "Delivery Return Bill" feature is not ready yet.
 *
 * The data lives in testData.json so that the QR code generator of the test
 * sheet (desktop folder wms-qr) reads exactly the same values.
 *
 * The shape of the objects is the one the server sends (SCREAMING_SNAKE).
 *
 * Bill 2026062030 (delivery bill 1326168351, customer SARL BOUGATTOUCHA):
 *   - 43A4200G : 5 units, 1 of them already returned (status C)
 *   - 43A4200H : 2 units, nothing returned yet
 *   - 43A4200K : 1 unit, allocated out (no delivery traceability)
 * Bill 2026062031 (delivery bill 1326168352, customer SPA INDUSTRIES):
 *   - 43B5500K : 2 units, nothing returned yet
 *
 * The GUID of a unit is used as its SN by the dummy traceability lookup.
 */

import seed from "./testData.json";
import { RawReturnBillLine } from "./types";

export const MOCK_BILL_LINES: RawReturnBillLine[] = seed.billLines as RawReturnBillLine[];

/** Physical details of the scanned barcode, used by the confirmation page. */
export const MOCK_SCAN_BARCODE_DETAILS: Record<
  string,
  { palletCode: string; boxCode: string; imei1: string; imei2: string; imei3: string; goodsCount: string }
> = seed.scanBarCodeDetails;
