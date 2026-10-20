/**
 * Local dummy data used while the backend endpoints of the "Delivery Return Bill"
 * feature are not ready yet.
 *
 * Every value returned by the dummy API calls comes from this file, so the whole
 * flow can be tested on the device:
 *   - SN0001 / SN0002  -> have delivery traceability -> confirm page
 *   - any other SN     -> traceability error      -> EAN page
 */

import { BillModelRow, TraceabilityRecord } from "./types";

export const MOCK_BILL_MODELS: BillModelRow[] = [
  {
    id: "0",
    systemDeliveryCode: "DR202610001",
    deliveryCode: "OP-2026-0001",
    model: "MDL-A100",
    color: "BLACK",
    supplierCode: "CUS001",
    operatorBatch: "OP-2026-0001",
    sapMainBillCode: "SRT20260001",
    fromck: "WH01",
    planQty: 10,
    doneQty: 4,
    diffQty: 6,
  },
  {
    id: "1",
    systemDeliveryCode: "DR202610002",
    deliveryCode: "OP-2026-0002",
    model: "MDL-B200",
    color: "WHITE",
    supplierCode: "CUS002",
    operatorBatch: "OP-2026-0002",
    sapMainBillCode: "SRT20260002",
    fromck: "WH01",
    planQty: 5,
    doneQty: 5,
    diffQty: 0,
  },
  {
    id: "2",
    systemDeliveryCode: "DR202610003",
    deliveryCode: "OP-2026-0003",
    model: "MDL-C300",
    color: "BLUE",
    supplierCode: "CUS003",
    operatorBatch: "OP-2026-0003",
    sapMainBillCode: "SRT20260003",
    fromck: "WH02",
    planQty: 20,
    doneQty: 2,
    diffQty: 18,
  },
];

/** SNs that have a delivery traceability record. Any other SN returns an error. */
export const MOCK_TRACEABILITY: Record<string, TraceabilityRecord> = {
  SN0001: {
    sn: "SN0001",
    model: "MDL-A100",
    color: "BLACK",
    palletCode: "PL00001",
    boxCode: "BX00001",
    imei1: "860111111111111",
    imei2: "860222222222222",
    imei3: "860333333333333",
    deliveryDate: "2026-10-12 09:31:00",
    ean: "6131000000017",
    productStatus: "DELIVERED",
    warehouseCode: "WH01",
    customerCode: "CUS001",
  },
  SN0002: {
    sn: "SN0002",
    model: "MDL-A100",
    color: "BLACK",
    palletCode: "PL00001",
    boxCode: "BX00002",
    imei1: "860111111111112",
    imei2: "860222222222223",
    imei3: "860333333333334",
    deliveryDate: "2026-10-12 09:35:00",
    ean: "6131000000017",
    productStatus: "DELIVERED",
    warehouseCode: "WH01",
    customerCode: "CUS001",
  },
};

/** EAN of the models used by the dummy traceability records. */
export const MOCK_MODEL_EAN: Record<string, string> = {
  "MDL-A100": "6131000000017",
  "MDL-B200": "6132000000024",
  "MDL-C300": "6133000000031",
};
