/**
 * Shared types for the "Delivery Return Bill" flow (SN based return with traceability).
 *
 * Flow:
 *   1. DeliveryReturnBillSelect  - scan the SAP return bill, select the model
 *   2. DeliveryReturnBillSN      - scan the product SN, check the delivery traceability
 *   3. DeliveryReturnBillEAN     - scan the EAN (only when the traceability check fails)
 *   4. DeliveryReturnBillConfirm - confirm the return (traceability found only)
 */

/** One model line of the scanned return bill. */
export interface BillModelRow {
  id: string;
  /** WMS bill code of the delivery (item.billCode) */
  systemDeliveryCode: string;
  /** Operator batch code of the delivery */
  deliveryCode: string;
  model: string;
  color: string;
  supplierCode: string;
  operatorBatch: string;
  sapMainBillCode: string;
  /** Warehouse the goods are coming back from */
  fromck: string;
  /** Planned quantity (hasDeliveryCount) */
  planQty: number;
  /** Already processed quantity (actualCount) */
  doneQty: number;
  /** planQty - doneQty */
  diffQty: number;
}

/** Delivery traceability of a scanned SN. */
export interface TraceabilityRecord {
  sn: string;
  model: string;
  color: string;
  palletCode: string;
  boxCode: string;
  imei1: string;
  imei2: string;
  imei3: string;
  /** Date the goods were delivered to the customer */
  deliveryDate: string;
  ean: string;
  /** Status of the product (e.g. Delivered / Returned) */
  productStatus: string;
  warehouseCode: string;
  customerCode: string;
}

/** Context passed from page to page. */
export interface ReturnContext {
  f_billCode: string;
  f_systemDeliveryCode: string;
  f_sapMainBillCode: string;
  f_model: string;
  f_color: string;
  f_customerCode: string;
  f_operatorBatch: string;
  f_wareCode: string;
  f_planQty: number;
  f_doneQty: number;
}

/** Result of a return submission (confirm or EAN submit). */
export interface ReturnResult {
  success: boolean;
  msg?: string;
  /** Processed quantity after the submission */
  actualQty?: number;
  /** Planned quantity of the model */
  planQty?: number;
  /** Product status after the submission */
  productStatus?: string;
}

/** Result of the SN traceability lookup. */
export interface TraceabilityCheckResult {
  /** true when the SN has delivery traceability (go straight to the confirm page) */
  found: boolean;
  trace?: TraceabilityRecord;
  /** Error message, set when the SN has no delivery traceability (EAN is required) */
  error?: string;
}
