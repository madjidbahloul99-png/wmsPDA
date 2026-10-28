/**
 * Shared types of the "Delivery Return Bill" flow (SN based return with traceability).
 *
 * Flow:
 *   1. DeliveryReturnBillSelect  - scan the SAP return bill, select the model
 *   2. DeliveryReturnBillSN      - scan the product SN, check the delivery traceability
 *   3. DeliveryReturnBillEAN     - scan the EAN (only when the traceability check fails)
 *   4. DeliveryReturnBillConfirm - confirm the return (traceability found only)
 */

/** One line of the return bill, mapped from the answer of ScanReturnBill. */
export interface ReturnBillLine {
  /** GUID of the line / of the unit */
  lineId: string;
  /** SAP return bill (the scanned bill) */
  mainBillCode: string;
  /** WMS delivery bill the goods come from */
  outBillCode: string;
  warehouseCode: string;
  toWarehouseCode: string;
  /** delivery bill the goods went out with (when the answer carries it) */
  deliveryCode: string;
  customerCode: string;
  customerName: string;
  cityCode: string;
  cityName: string;
  address: string;
  customerType: string;
  model: string;
  modelDesc: string;
  color: string;
  ean: string;
  brand: string;
  materialType: string;
  deliveryDate: string;
  billCount: number;
  priceHt: number;
  /** status of the goods movement, "C" = completed */
  movementStatus: string;
  movementDate: string;
  /** DELIVERY / ALLOCATEOUT / RETURN */
  movementType: string;
  /** planned quantity of the line (qty / BILL_COUNT) */
  planQty: number;
  /** processed quantity of the line (qtyOk, or 1 when the status is "C") */
  doneQty: number;
}

/** One model row of the scanned return bill (a line grouped by model). */
export interface BillModelRow {
  id: string;
  /** GUID of the first line of the model */
  lineId: string;
  /** WMS delivery bill */
  systemDeliveryCode: string;
  deliveryCode: string;
  model: string;
  modelDesc: string;
  color: string;
  ean: string;
  brand: string;
  customerCode: string;
  customerName: string;
  cityName: string;
  address: string;
  customerType: string;
  operatorBatch: string;
  sapMainBillCode: string;
  fromck: string;
  toWarehouseCode: string;
  deliveryDate: string;
  movementStatus: string;
  movementDate: string;
  movementType: string;
  /** planned quantity of this customer for this model */
  planQty: number;
  /** already processed quantity of this customer for this model */
  doneQty: number;
  /** planQty - doneQty */
  diffQty: number;
}

/**
 * One model of the scanned return bill, with one row per customer.
 *
 * A return bill can hold several customers (multi client), and the same model
 * can belong to more than one of them.
 */
export interface BillModelGroup {
  id: string;
  model: string;
  modelDesc: string;
  color: string;
  ean: string;
  brand: string;
  /** planned quantity of the model (all its customers) */
  planQty: number;
  /** already processed quantity of the model (all its customers) */
  doneQty: number;
  /** planQty - doneQty */
  diffQty: number;
  /** one row per customer of the model */
  rows: BillModelRow[];
}

/** One model of the EAN list, the answer of CheckEAN (CheckEANResponse). */
export interface EANCandidate {
  model: string;
  modelDesc: string;
  colorName: string;
  ean: string;
}

/** Delivery traceability of a scanned SN (ValidateProductSNResponse). */
export interface TraceabilityRecord {
  sn: string;
  lineId: string;
  mainBillCode: string;
  /** WMS delivery bill the goods went out with */
  outBillCode: string;
  /** SAP main bill of the delivery */
  sapMainBillCode: string;
  /** SAP line id of the delivery */
  sapUuid: string;
  model: string;
  modelDesc: string;
  color: string;
  ean: string;
  brand: string;
  customerCode: string;
  customerName: string;
  warehouseCode: string;
  toWarehouseCode: string;
  /** date the goods were delivered to the customer */
  deliveryDate: string;
  /** status of the goods movement */
  movementStatus: string;
  movementDate: string;
  /** DELIVERY / ALLOCATEOUT / RETURN */
  movementType: string;
  /** product status shown on the confirmation page */
  productStatus: string;
  /** physical details of the scanned barcode */
  palletCode: string;
  boxCode: string;
  imei1: string;
  imei2: string;
  imei3: string;
  goodsCount: string;
}

/** Context passed from page to page. */
export interface ReturnContext {
  /** scanned SAP return bill */
  f_billCode: string;
  /** WMS delivery bill */
  f_systemDeliveryCode: string;
  f_sapMainBillCode: string;
  /** GUID of the selected line */
  f_lineId: string;
  f_model: string;
  f_modelDesc: string;
  f_color: string;
  /** expected EAN of the model (CODE_EAN of the line) */
  f_ean: string;
  f_brand: string;
  f_customerCode: string;
  f_customerName: string;
  f_cityName: string;
  f_address: string;
  f_customerType: string;
  f_operatorBatch: string;
  f_wareCode: string;
  f_toWarehouseCode: string;
  f_deliveryDate: string;
  f_movementStatus: string;
  f_movementDate: string;
  f_movementType: string;
  f_planQty: number;
  f_doneQty: number;
  f_diffQty: number;
}

/** Result of a return submission (confirm or EAN submit). */
export interface ReturnResult {
  success: boolean;
  msg?: string;
  /** processed quantity after the submission */
  actualQty?: number;
  /** planned quantity of the model */
  planQty?: number;
  /** product status after the submission */
  productStatus?: string;
  /** true when the whole return bill is finished */
  billFinished?: boolean;
}

/** Result of the SN traceability lookup. */
export interface TraceabilityCheckResult {
  /** true when the SN has delivery traceability (go straight to the confirm page) */
  found: boolean;
  /** the traceability records of the SN, one row each on the confirmation page */
  traces: TraceabilityRecord[];
  /** error message, set when the SN has no delivery traceability */
  error?: string;
  /**
   * true when the product was not found, the EAN has to be scanned to
   * identify it (the EAN page).
   */
  requiresEan?: boolean;
  /** true when the product was already scanned, the operator stays on the page */
  alreadyScanned?: boolean;
}

/** Result of the EAN lookup of the EAN page (CheckEAN). */
export interface EANLookupResult {
  /** the models that carry the scanned EAN, the operator picks one */
  candidates: EANCandidate[];
  /** message shown to the operator */
  message?: string;
}
