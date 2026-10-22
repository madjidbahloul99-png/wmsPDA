/**
 * API layer of the "Delivery Return Bill" feature.
 *
 * The calls go to the real backend "api/DeliveryReturn" of the WMS API
 * (Controllers/DeliveryReturnNew/DeliveryReturnNewController.cs):
 *
 *   GET  api/DeliveryReturn/ScanReturnBill?returnBillCode=&warehouseCode=
 *   GET  api/DeliveryReturn/ValidateProductSN?sn=&modelCode=
 *   GET  api/DeliveryReturn/CheckEAN?ean=
 *   POST api/DeliveryReturn/SaveReturnDetail        (JSON body)
 *
 * GET requests use the [FromQuery] models, the POST uses [FromBody].
 * The answers are the envelope ApiResponse<T>: { code, message, data } (the
 * exception middleware answers { Code, Message, Data } on errors).
 *
 * Every request carries the sign fields of Controllers/Model/BaseSignInfo.cs:
 * operateUserCode / operateUserName / operateWareHouseCode /
 * operateRandomNumber / operateSign / operateVersion, with
 * MD5(userCode + userName + randomNumber + password salt) - the same formula
 * as the legacy pubfunction.GetUserSign, only the field names differ (this
 * API reads the "operate*" names).
 */
import * as pubfunction from "../pubfunction";
import {
  BillModelGroup,
  BillModelRow,
  EANCandidate,
  EANLookupResult,
  ReturnBillLine,
  ReturnContext,
  ReturnResult,
  TraceabilityCheckResult,
  TraceabilityRecord,
} from "./types";

/** Base path of the feature on the WMS API. */
export const API_PATH = "/api/DeliveryReturn";

/** Scan types of the save request. */
export const SCAN_TYPE_TRACE = "TRACE";
export const SCAN_TYPE_EAN = "EAN";

/** Status of the goods movement, "C" = the unit was already returned. */
export const GOODS_MOVEMENT_STATUS_DONE = "C";

/** Everything the API layer needs from the global context. */
export interface ApiContext {
  gs_BaseURL: string;
  gs_wareCode: string;
  gs_userCode: string;
  gs_userName: string;
  gs_PasswordSalt: string;
  gs_version: string;
  gs_classCode: string;
  gs_IPAddress: string;
}

/* ==========================================================================
   The sign of BaseSignInfo
   ========================================================================== */

/**
 * Sign fields of the WMS API (Controllers/Model/BaseSignInfo.cs).
 *
 * The MD5 is the same as the legacy GetUserSign: userCode + userName +
 * randomNumber + password salt. Only the field names differ - this API reads
 * the "operate*" naming, not the legacy "operator*" one.
 */
export const getOperateSign = (ctx: ApiContext): Record<string, string> => {
  const userCode = ctx.gs_userCode || "admin";
  const userName = ctx.gs_userName || userCode;
  const randomNumber = "2";
  const sign = pubfunction.MD5(userCode + userName + randomNumber + ctx.gs_PasswordSalt);
  return {
    operateUserCode: userCode,
    operateUserName: userName,
    operateWareHouseCode: ctx.gs_wareCode,
    operateRandomNumber: randomNumber,
    operateSign: sign,
    operateVersion: ctx.gs_version,
  };
};

/* ==========================================================================
   Requests
   ========================================================================== */

/** Unpacked answer of the WMS API (the envelope ApiResponse<T>). */
interface ApiEnvelope {
  ok: boolean;
  code: number;
  message: string;
  data: any;
}

/**
 * Reads the answer envelope. The controllers serialize { code, message, data },
 * the exception middleware serializes { Code, Message, Data }, both are accepted.
 */
const readEnvelope = (resData: any, httpStatus: number): ApiEnvelope => {
  const raw = resData && typeof resData === "object" ? resData : {};
  const code = raw.code !== undefined ? raw.code : raw.Code;
  const message = raw.message !== undefined ? raw.message : raw.Message;
  const data = raw.data !== undefined ? raw.data : raw.Data;
  return {
    ok: Number(code) === 200,
    code: Number(code !== undefined ? code : httpStatus),
    message: message === undefined || message === null ? "" : String(message),
    data,
  };
};

/** Builds the query string of a signed GET. */
const buildQuery = (params: Record<string, string>): string =>
  Object.keys(params)
    .map(
      (key) =>
        encodeURIComponent(key) + "=" + encodeURIComponent(params[key] ?? "")
    )
    .join("&");

/** GET against api/DeliveryReturn, throws an Error with the server message. */
const requestGet = async (
  ctx: ApiContext,
  path: string,
  params: Record<string, string>
): Promise<ApiEnvelope> => {
  const url = `${ctx.gs_BaseURL}${path}?${buildQuery(params)}`;
  const response = await fetch(url, { method: "GET" });
  let resData: any = null;
  try {
    resData = await response.json();
  } catch {
    // no body or no json, the status tells the outcome
  }
  const envelope = readEnvelope(resData, response.status);
  if (!envelope.ok) {
    throw new Error(envelope.message || `HTTP Error: ${response.status}`);
  }
  return envelope;
};

/** POST (JSON body) against api/DeliveryReturn, throws on a server message. */
const requestPost = async (
  ctx: ApiContext,
  path: string,
  body: Record<string, any>
): Promise<ApiEnvelope> => {
  const url = `${ctx.gs_BaseURL}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let resData: any = null;
  try {
    resData = await response.json();
  } catch {
    // no body or no json, the status tells the outcome
  }
  const envelope = readEnvelope(resData, response.status);
  if (!envelope.ok) {
    throw new Error(envelope.message || `HTTP Error: ${response.status}`);
  }
  return envelope;
};

/* ==========================================================================
   Mapping of the payload
   ========================================================================== */

/** Returns the first non empty value among the aliases of a field. */
const pickText = (row: any, keys: string[]): string => {
  for (const key of keys) {
    const value = row ? row[key] : undefined;
    if (value !== undefined && value !== null && String(value) !== "") {
      return String(value);
    }
  }
  return "";
};

/** Returns the first numeric value among the aliases of a field. */
const pickNumber = (row: any, keys: string[]): number | null => {
  for (const key of keys) {
    const value = row ? row[key] : undefined;
    if (value !== undefined && value !== null && value !== "") {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return null;
};

/**
 * Maps one line of the scanned return bill.
 *
 * Two shapes are accepted:
 *   - the fields of the current API answer (MAIN_BILL_CODE, OUT_BILL_CODE,
 *     GUID, MODEL, BILL_COUNT, GOODS_MOVEMENT_STATUS, ...),
 *   - the lower case columns of the plan table once they are exposed
 *     (id, deliveryCode, qty, qtyOk, ...), they win when they are present.
 *
 * The planned quantity of a line comes from qty, or BILL_COUNT when the plan
 * quantities are not exposed yet; a line that has no explicit qtyOk is done
 * when its movement status is "C".
 */
export const mapRawLine = (raw: any): ReturnBillLine => {
  const movementStatus = pickText(raw, [
    "GOODS_MOVEMENT_STATUS",
    "goodsMovementStatus",
    "movementStatus",
  ]);
  const planQty = pickNumber(raw, ["qty", "Qty", "BILL_COUNT", "billCount"]);
  const billCount = planQty !== null && planQty > 0 ? planQty : 1;
  const okQty = pickNumber(raw, ["qtyOk", "QtyOk", "OK_QTY"]);
  const doneQty =
    okQty !== null ? okQty : movementStatus === GOODS_MOVEMENT_STATUS_DONE ? billCount : 0;

  return {
    // the plan row id (planId of the save), the GUID is the answer of today
    lineId: pickText(raw, ["id", "Id", "ID", "GUID", "guid", "planId"]),
    // the SAP return bill (the scanned code), the delivery bill when present
    mainBillCode: pickText(raw, [
      "MAIN_BILL_CODE",
      "mainBillCode",
      "systemDeliveryCode",
    ]),
    // the delivery bill the goods went out with
    outBillCode: pickText(raw, [
      "OUT_BILL_CODE",
      "outBillCode",
      "deliveryCode",
    ]),
    // the operation batch column of the lists
    deliveryCode: pickText(raw, ["deliveryCode"]),
    warehouseCode: pickText(raw, [
      "WAREHOUSE_CODE",
      "warehouseCode",
      "deliveryWareHouseCode",
    ]),
    toWarehouseCode: pickText(raw, ["TO_WAREHOUSE_CODE", "toWarehouseCode"]),
    customerCode: pickText(raw, ["CUSTOMER_CODE", "customerCode"]),
    customerName: pickText(raw, ["CUSTOMER_NAME", "customerName"]),
    cityCode: pickText(raw, ["CITY_CODE", "cityCode"]),
    cityName: pickText(raw, ["CITY_NAME", "cityName"]),
    address: pickText(raw, ["ADDRESS", "address"]),
    customerType: pickText(raw, ["CUSTOMER_TYPE", "customerType"]),
    model: pickText(raw, ["MODEL", "model"]),
    modelDesc: pickText(raw, ["MODEL_DESC", "modelDesc"]),
    color: pickText(raw, ["COLOR_NAME", "colorName", "color"]),
    ean: pickText(raw, ["CODE_EAN", "ean"]).toUpperCase().trim(),
    brand: pickText(raw, ["BRAND", "brand"]),
    materialType: pickText(raw, ["MATERIAL_TYPE", "materialType"]),
    deliveryDate: pickText(raw, ["DELIVERY_DATE", "deliveryDate"]),
    billCount,
    priceHt: pickNumber(raw, ["PRICE_HT", "priceHt"]) ?? 0,
    movementStatus,
    movementDate: pickText(raw, ["GOODS_MOVEMENT_DATE", "movementDate"]),
    movementType: pickText(raw, ["DELIVERY_OR_ALLOCATEOUT", "movementType"]),
    planQty: billCount,
    doneQty,
  };
};

/** Maps one line of the EAN lookup (the answer of CheckEAN). */
export const mapEANCandidate = (raw: any): EANCandidate => ({
  model: pickText(raw, ["model", "MODEL"]),
  modelDesc: pickText(raw, ["modelDesc", "MODEL_DESC"]),
  colorName: pickText(raw, ["colorName", "COLOR_NAME"]),
  ean: pickText(raw, ["ean", "CODE_EAN"]),
});

/**
 * Groups the lines of a bill by model, and the lines of a model by customer.
 *
 * A return bill can hold several customers (multi client) and the same model
 * can belong to more than one of them, so the rows are kept per customer.
 */
export const aggregateByModel = (lines: ReturnBillLine[]): BillModelGroup[] => {
  const modelGroups: { [key: string]: ReturnBillLine[] } = {};

  lines.forEach((line) => {
    const key = `${line.model}|${line.color}|${line.ean}`;
    if (!modelGroups[key]) {
      modelGroups[key] = [];
    }
    modelGroups[key].push(line);
  });

  return Object.keys(modelGroups).map((key, idx) => {
    const group = modelGroups[key];
    const first = group[0];

    // One row per customer of the model
    const customerGroups: { [key: string]: ReturnBillLine[] } = {};
    group.forEach((line) => {
      const customerKey = `${line.customerCode}|${line.customerName}|${line.outBillCode}`;
      if (!customerGroups[customerKey]) {
        customerGroups[customerKey] = [];
      }
      customerGroups[customerKey].push(line);
    });

    const rows: BillModelRow[] = Object.keys(customerGroups).map((customerKey, rowIdx) => {
      const customerLines = customerGroups[customerKey];
      const customer = customerLines[0];

      let planQty = 0;
      let doneQty = 0;
      customerLines.forEach((line) => {
        planQty += line.planQty;
        doneQty += line.doneQty;
      });

      return {
        id: `${idx}-${rowIdx}`,
        lineId: customer.lineId,
        systemDeliveryCode: customer.outBillCode,
        deliveryCode: customer.outBillCode,
        model: customer.model,
        modelDesc: customer.modelDesc,
        color: customer.color,
        ean: customer.ean,
        brand: customer.brand,
        customerCode: customer.customerCode,
        customerName: customer.customerName,
        cityName: customer.cityName,
        address: customer.address,
        customerType: customer.customerType,
        // the batch of the operation, the delivery bill when present
        operatorBatch: customer.deliveryCode || customer.lineId,
        sapMainBillCode: customer.mainBillCode,
        fromck: customer.warehouseCode,
        toWarehouseCode: customer.toWarehouseCode,
        deliveryDate: customer.deliveryDate,
        movementStatus: customer.movementStatus,
        movementDate: customer.movementDate,
        movementType: customer.movementType,
        planQty,
        doneQty,
        diffQty: planQty - doneQty,
      };
    });

    const planQty = rows.reduce((sum, row) => sum + row.planQty, 0);
    const doneQty = rows.reduce((sum, row) => sum + row.doneQty, 0);

    return {
      id: String(idx),
      model: first.model,
      modelDesc: first.modelDesc,
      color: first.color,
      ean: first.ean,
      brand: first.brand,
      planQty,
      doneQty,
      diffQty: planQty - doneQty,
      rows,
    };
  });
};

/* ==========================================================================
   API 1 - the lines of the scanned return bill
   ========================================================================== */

/**
 * GET ScanReturnBill?returnBillCode=&warehouseCode=
 *
 * The server filters the bill by the logged in warehouse: when the bill is not
 * of this warehouse the answer is "No model found for this bill in your
 * warehouse", the screen shows exactly that message.
 */
export async function getBillModels(
  ctx: ApiContext,
  params: { sapMainBillCode: string }
): Promise<BillModelGroup[]> {
  const envelope = await requestGet(ctx, `${API_PATH}/ScanReturnBill`, {
    returnBillCode: params.sapMainBillCode,
    warehouseCode: ctx.gs_wareCode,
    userCode: ctx.gs_userCode || "admin",
    userName: ctx.gs_userName || "",
    ...getOperateSign(ctx),
  });
  const rows: any[] = Array.isArray(envelope.data) ? envelope.data : [];
  return aggregateByModel(rows.map((raw) => mapRawLine(raw)));
}

/* ==========================================================================
   API 2 - the delivery traceability of a scanned SN
   ========================================================================== */

/**
 * GET ValidateProductSN?sn=&modelCode=
 *
 * traceabilityExists = true  -> the operator goes to the confirm page
 * traceabilityExists = false -> no delivery found for this SN, the EAN page
 *
 * A model mismatch answers as an exception of the server, the screen shows its
 * message: "SN model X does not match the selected model Y".
 */
export async function checkSNTraceability(
  ctx: ApiContext,
  params: { sn: string; mainBillCode: string; model: string }
): Promise<TraceabilityCheckResult> {
  const envelope = await requestGet(ctx, `${API_PATH}/ValidateProductSN`, {
    sn: params.sn,
    modelCode: params.model || "",
    ...getOperateSign(ctx),
  });
  const res = envelope.data || {};
  const traceabilityExists = res.traceabilityExists === true;
  const trace: TraceabilityRecord = {
    sn: params.sn,
    lineId: "",
    mainBillCode: "",
    outBillCode: pickText(res, ["outBillCode", "out_bill_code"]),
    sapMainBillCode: pickText(res, ["sapMainBillCode", "sap_main_bill_code"]),
    sapUuid: pickText(res, ["sapUuid", "sap_uuid"]),
    model: pickText(res, ["model"]) || params.model,
    modelDesc: "",
    color: "",
    ean: "",
    brand: "",
    customerCode: "",
    customerName: "",
    warehouseCode: ctx.gs_wareCode,
    toWarehouseCode: "",
    deliveryDate: "",
    movementStatus: "",
    movementDate: "",
    movementType: "",
    productStatus: "",
    palletCode: "",
    boxCode: "",
    imei1: "",
    imei2: "",
    imei3: "",
    goodsCount: "",
  };
  return {
    found: traceabilityExists,
    traces: traceabilityExists ? [trace] : [],
    requiresEan: !traceabilityExists,
    error: traceabilityExists
      ? undefined
      : pickText(res, ["message"]) ||
        "No delivery found for this SN, please scan the EAN",
  };
}

/* ==========================================================================
   API 3 - the models of a scanned EAN
   ========================================================================== */

/**
 * GET CheckEAN?ean=
 *
 * The EAN is matched to a model: the answer is the list of the models that
 * carry it, the operator picks the one matching the product and confirms.
 * Identical model/color rows are shown once.
 */
export async function lookupByEAN(
  ctx: ApiContext,
  params: { ean: string; mainBillCode: string }
): Promise<EANLookupResult> {
  const envelope = await requestGet(ctx, `${API_PATH}/CheckEAN`, {
    ean: params.ean,
    ...getOperateSign(ctx),
  });
  const rows: any[] = Array.isArray(envelope.data) ? envelope.data : [];
  const seen: { [key: string]: boolean } = {};
  const candidates = rows
    .map((raw) => mapEANCandidate(raw))
    .filter((candidate) => {
      const key = `${candidate.model}|${candidate.colorName}|${candidate.ean}`;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  return {
    candidates,
    message:
      candidates.length > 0
        ? `${candidates.length} model(s) found, please select one.`
        : "EAN not found",
  };
}

/* ==========================================================================
   API 4 - the save of the return
   ========================================================================== */

/** Body of the save request (SaveReturnDetailRequest). */
const buildSaveBody = (
  ctx: ApiContext,
  payload: {
    context: ReturnContext;
    sn: string;
    model: string;
    ean: string;
    scanType: string;
    trace?: TraceabilityRecord | null;
  }
): Record<string, any> => ({
  returnBillCode: payload.context.f_billCode || "",
  planId: payload.context.f_lineId || "",
  warehouseCode: ctx.gs_wareCode || "",
  sn: payload.sn,
  model: payload.model,
  ean: payload.ean || "",
  scanType: payload.scanType,
  outBillCode: (payload.trace && payload.trace.outBillCode) || "",
  sapMainBillCode:
    (payload.trace && payload.trace.sapMainBillCode) ||
    payload.context.f_sapMainBillCode ||
    "",
  sapUuid: (payload.trace && payload.trace.sapUuid) || "",
  userCode: ctx.gs_userCode || "admin",
  userName: ctx.gs_userName || "",
  ...getOperateSign(ctx),
});

/** Maps the answer of the save (SaveReturnDetailResponse). */
const mapSaveResponse = (res: any): ReturnResult => ({
  success: true,
  planQty: pickNumber(res, ["qty"]) ?? 0,
  actualQty: pickNumber(res, ["qtyOk"]) ?? 0,
  productStatus: res.billFinished === true ? "BILL FINISHED" : "RETURNED",
  billFinished: res.billFinished === true,
});

/**
 * POST SaveReturnDetail (scanType = "TRACE")
 *
 * The server refuses an SN that was already scanned in the bill ("SN already
 * scanned in this return bill") and a completed row ("This model is already
 * completed"), the screens show those messages.
 */
export async function confirmReturn(
  ctx: ApiContext,
  payload: {
    context: ReturnContext;
    sn: string;
    trace?: TraceabilityRecord | null;
  }
): Promise<ReturnResult> {
  const envelope = await requestPost(
    ctx,
    `${API_PATH}/SaveReturnDetail`,
    buildSaveBody(ctx, {
      context: payload.context,
      sn: payload.sn,
      model: payload.context.f_model,
      ean: "",
      scanType: SCAN_TYPE_TRACE,
      trace: payload.trace || null,
    })
  );
  return mapSaveResponse(envelope.data || {});
}

/**
 * POST SaveReturnDetail (scanType = "EAN")
 *
 * The model is the one the operator selected in the list of the EAN page, the
 * SN is the one that had no delivery traceability.
 */
export async function submitReturnWithEAN(
  ctx: ApiContext,
  payload: {
    context: ReturnContext;
    sn: string;
    ean: string;
    model: string;
  }
): Promise<ReturnResult> {
  const envelope = await requestPost(
    ctx,
    `${API_PATH}/SaveReturnDetail`,
    buildSaveBody(ctx, {
      context: payload.context,
      sn: payload.sn,
      model: payload.model,
      ean: payload.ean,
      scanType: SCAN_TYPE_EAN,
      trace: null,
    })
  );
  return mapSaveResponse(envelope.data || {});
}
