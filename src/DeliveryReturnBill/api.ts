/**
 * API layer of the "Delivery Return Bill" feature.
 *
 * Two data sources share the same public functions:
 *
 *   - the real backend, "api/DeliveryReturn" of the WMS API
 *     (Controllers/DeliveryReturnNew/DeliveryReturnNewController.cs), used when
 *     USE_DUMMY is switched off with setMockMode(false):
 *
 *       GET  api/DeliveryReturn/ScanReturnBill?returnBillCode=&warehouseCode=
 *       GET  api/DeliveryReturn/ValidateProductSN?sn=&modelCode=
 *       GET  api/DeliveryReturn/CheckEAN?ean=
 *       POST api/DeliveryReturn/SaveReturnDetail        (JSON body)
 *
 *       GET requests use the [FromQuery] models, the POST uses [FromBody].
 *       The answers are the envelope ApiResponse<T>: { code, message, data }
 *       (the exception middleware answers { Code, Message, Data } on errors).
 *
 *       Every request carries the sign fields of Controllers/Model/BaseSignInfo.cs:
 *       operateUserCode / operateUserName / operateWareHouseCode /
 *       operateRandomNumber / operateSign / operateVersion, with
 *       MD5(userCode + userName + randomNumber + password salt) - the same
 *       formula as the legacy pubfunction.GetUserSign, only the field names
 *       differ (this API reads the "operate*" names).
 *
 *   - the dummy store (mockData.ts / mockStore.ts), used when USE_DUMMY is on
 *     (the default, while the backend is not deployed).
 */
import * as pubfunction from "../pubfunction";
import {
  BillModelGroup,
  BillModelRow,
  EANCandidate,
  EANLookupResult,
  RawReturnBillLine,
  ReturnBillLine,
  ReturnContext,
  ReturnResult,
  TraceabilityCheckResult,
  TraceabilityRecord,
} from "./types";
import { MOCK_SCAN_BARCODE_DETAILS } from "./mockData";
import {
  findUnit,
  findUnits,
  getAllLines,
  getLinesByBill,
  markReturned,
} from "./mockStore";

/**
 * Dummy data while the backend is not deployed.
 * Flip it off with setMockMode(false) to call the real "api/DeliveryReturn".
 */
export let USE_DUMMY = true;

/** Switches between the dummy store and the real API. */
export const setMockMode = (enable: boolean): void => {
  USE_DUMMY = enable;
};

/** Bill type of a delivery return, only used by the legacy barcode enrichment. */
export const BILL_TYPE_RETURN = "5003";

/** Base path of the feature on the WMS API. */
export const API_PATH = "/api/DeliveryReturn";

/** Scan types of the save request. */
export const SCAN_TYPE_TRACE = "TRACE";
export const SCAN_TYPE_EAN = "EAN";

/** Status of the goods movement, "C" = the unit was already returned. */
export const GOODS_MOVEMENT_STATUS_DONE = "C";

/** Movement types that give a delivery traceability (dummy decision only). */
export const TRACEABLE_MOVEMENT_TYPES = ["DELIVERY", "RETURN"];

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

/** Physical details of a scanned barcode, only used by the dummy flow. */
export interface ScanBarCodeDetails {
  palletCode: string;
  boxCode: string;
  imei1: string;
  imei2: string;
  imei3: string;
  goodsCount: string;
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
   Requests to the WMS API
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
  const raw =
    resData && typeof resData === "object" ? resData : {};
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
    // DELIVERY / ALLOCATEOUT / RETURN, only used by the dummy decision
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

/**
 * Planned and processed quantity of a model of a bill (dummy store only).
 */
export const getModelCounts = (
  mainBillCode: string,
  model: string,
  customerCode?: string
): { planQty: number; doneQty: number; diffQty: number } => {
  const groups = aggregateByModel(
    getLinesByBill(mainBillCode).map((raw) => mapRawLine(raw))
  );
  const group = groups.find((g) => g.model === model);
  if (!group) return { planQty: 0, doneQty: 0, diffQty: 0 };

  if (customerCode) {
    const row = group.rows.find((r) => r.customerCode === customerCode);
    if (row) {
      return { planQty: row.planQty, doneQty: row.doneQty, diffQty: row.diffQty };
    }
  }

  return { planQty: group.planQty, doneQty: group.doneQty, diffQty: group.diffQty };
};

/** Builds the traceability record of a unit (dummy store only). */
const buildTrace = (raw: RawReturnBillLine): TraceabilityRecord => {
  const line = mapRawLine(raw);
  const digits = (raw.GUID || "").slice(-12);
  const details = MOCK_SCAN_BARCODE_DETAILS[raw.GUID] || {
    palletCode: `PL${raw.OUT_BILL_CODE || ""}`,
    boxCode: `BX${(raw.GUID || "").slice(-8)}`,
    imei1: `860${digits}`,
    imei2: `861${digits}`,
    imei3: `862${digits}`,
    goodsCount: String(line.billCount || 1),
  };

  return {
    sn: raw.GUID,
    lineId: line.lineId,
    mainBillCode: line.mainBillCode,
    outBillCode: line.outBillCode,
    sapMainBillCode: line.mainBillCode,
    sapUuid: "",
    model: line.model,
    modelDesc: line.modelDesc,
    color: line.color,
    ean: line.ean,
    brand: line.brand,
    customerCode: line.customerCode,
    customerName: line.customerName,
    warehouseCode: line.warehouseCode,
    toWarehouseCode: line.toWarehouseCode,
    deliveryDate: line.deliveryDate,
    movementStatus: line.movementStatus,
    movementDate: line.movementDate,
    movementType: line.movementType,
    productStatus: line.movementStatus,
    palletCode: details.palletCode,
    boxCode: details.boxCode,
    imei1: details.imei1,
    imei2: details.imei2,
    imei3: details.imei3,
    goodsCount: details.goodsCount,
  };
};

/* ==========================================================================
   Real requests of the WMS API
   ========================================================================== */

/**
 * API 1 - the lines of the scanned return bill.
 *
 * The server filters the bill by the logged in warehouse: when the bill is not
 * of this warehouse the answer is "No model found for this bill in your
 * warehouse", the screen shows exactly that message.
 */
export async function remoteGetBillModels(
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

/**
 * API 2 - the delivery traceability of a scanned SN.
 *
 * traceabilityExists = true  -> the operator goes to the confirm page
 * traceabilityExists = false -> no delivery found for this SN, the EAN page
 */
export async function remoteCheckSNTraceability(
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

/**
 * API 3 - the models of a scanned EAN.
 *
 * The EAN is matched to a model: the answer is the list of the models that
 * carry it, the operator picks the one matching the product and confirms.
 */
export async function remoteLookupByEAN(
  ctx: ApiContext,
  params: { ean: string; mainBillCode: string }
): Promise<EANLookupResult> {
  const envelope = await requestGet(ctx, `${API_PATH}/CheckEAN`, {
    ean: params.ean,
    ...getOperateSign(ctx),
  });
  const rows: any[] = Array.isArray(envelope.data) ? envelope.data : [];
  // The choice is a model, identical model/color rows are shown once
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

/** Body of the save request (ScanReturnDetailModels.cs). */
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
const mapSaveResponse = (
  payload: { context: ReturnContext; sn: string; model: string; scanType: string },
  res: any
): ReturnResult => ({
  success: true,
  planQty: pickNumber(res, ["qty"]) ?? 0,
  actualQty: pickNumber(res, ["qtyOk"]) ?? 0,
  productStatus: res.billFinished === true ? "BILL FINISHED" : "RETURNED",
  billFinished: res.billFinished === true,
});

/**
 * API 4 - saves the return of a product with a delivery traceability.
 */
export async function remoteConfirmReturn(
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
  return mapSaveResponse(
    {
      context: payload.context,
      sn: payload.sn,
      model: payload.context.f_model,
      scanType: SCAN_TYPE_TRACE,
    },
    envelope.data || {}
  );
}

/**
 * API 4 - saves the return of a product identified by its EAN.
 *
 * The model is the one the operator selected in the list of the EAN page, the
 * SN is the one that had no delivery traceability.
 */
export async function remoteSubmitReturnWithEAN(
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
  return mapSaveResponse(
    {
      context: payload.context,
      sn: payload.sn,
      model: payload.model,
      scanType: SCAN_TYPE_EAN,
    },
    envelope.data || {}
  );
}

/* ==========================================================================
   Public API
   ========================================================================== */

/**
 * Page 1: loads the models of the scanned return bill.
 */
export async function getBillModels(
  ctx: ApiContext,
  params: { sapMainBillCode: string }
): Promise<BillModelGroup[]> {
  if (USE_DUMMY) {
    const lines = getLinesByBill(params.sapMainBillCode).map((raw) =>
      mapRawLine(raw)
    );
    return aggregateByModel(lines);
  }
  return remoteGetBillModels(ctx, params);
}

/**
 * EAN of a model, fallback when the return bill line has no EAN (dummy only).
 */
export async function getModelEAN(ctx: ApiContext, model: string): Promise<string> {
  const line = getAllLines().find((raw) => raw.MODEL === model);
  return ((line && line.CODE_EAN) || "").toUpperCase().trim();
}

/**
 * Page 2: checks whether the scanned SN has a delivery traceability.
 *
 * When the traceability is found the operator goes straight to the confirm
 * page, when the lookup fails the EAN has to be scanned (EAN page).
 */
export async function checkSNTraceability(
  ctx: ApiContext,
  params: { sn: string; mainBillCode: string; model: string }
): Promise<TraceabilityCheckResult> {
  if (USE_DUMMY) {
    // The products of the model that have to be scanned, the scanned SN has to
    // be one of them (the customer is only a column of the list)
    const list = getLinesByBill(params.mainBillCode).filter(
      (raw) => !params.model || raw.MODEL === params.model
    );
    const unit = list.find((raw) => (raw.GUID || "").toUpperCase() === params.sn);

    if (!unit) {
      // the SN is not in the list of the products to return
      const elsewhere = findUnits(params.sn);
      if (elsewhere.length === 0) {
        return {
          found: false,
          traces: [],
          requiresEan: true,
          error: `SN ${params.sn} not found, please scan the EAN.`,
        };
      }

      const other = elsewhere[0];
      if (other.MAIN_BILL_CODE !== params.mainBillCode) {
        return {
          found: false,
          traces: [],
          requiresEan: true,
          error: `SN ${params.sn} not found on this bill, please scan the EAN.`,
        };
      }

      return {
        found: false,
        traces: [],
        requiresEan: true,
        error: `SN ${params.sn} is of model ${other.MODEL}, not ${params.model}, please scan the EAN.`,
      };
    }

    if (unit.GOODS_MOVEMENT_STATUS === GOODS_MOVEMENT_STATUS_DONE) {
      // the product is already in the list of the scanned items
      return {
        found: false,
        traces: [],
        alreadyScanned: true,
        error: "This product was already scanned.",
      };
    }

    if (TRACEABLE_MOVEMENT_TYPES.indexOf(unit.DELIVERY_OR_ALLOCATEOUT) < 0) {
      // the product has no delivery traceability, the EAN identifies it
      return {
        found: false,
        traces: [],
        requiresEan: true,
        error: `SN ${params.sn} not found, please scan the EAN.`,
      };
    }

    return { found: true, traces: [buildTrace(unit)] };
  }

  return remoteCheckSNTraceability(ctx, params);
}

/**
 * Physical details of a scanned barcode (pallet, box, IMEI), dummy only.
 */
export async function getScanBarCodeDetails(
  ctx: ApiContext,
  params: { billCode: string; sn: string; model: string }
): Promise<ScanBarCodeDetails> {
  const unit = findUnit(params.sn);
  const key = unit ? unit.GUID : params.sn;
  const details = MOCK_SCAN_BARCODE_DETAILS[key];
  return details
    ? { ...details }
    : { palletCode: "", boxCode: "", imei1: "", imei2: "", imei3: "", goodsCount: "1" };
}

/**
 * Page 4: confirms the return of a product that has a delivery traceability.
 */
export async function confirmReturn(
  ctx: ApiContext,
  payload: {
    context: ReturnContext;
    sn: string;
    trace?: TraceabilityRecord | null;
  }
): Promise<ReturnResult> {
  if (USE_DUMMY) {
    // the unit is flagged as returned in the store
    markReturned(payload.sn);
    const counts = getModelCounts(payload.context.f_billCode, payload.context.f_model);
    return {
      success: true,
      actualQty: counts.doneQty,
      planQty: counts.planQty,
      productStatus: counts.doneQty >= counts.planQty ? "BILL FINISHED" : "RETURNED",
      billFinished: counts.doneQty >= counts.planQty,
    };
  }
  return remoteConfirmReturn(ctx, payload);
}

/**
 * Page 3: looks up the models of a scanned EAN.
 *
 * The EAN is matched to a model, so the list is a list of models the operator
 * chooses from; there is no automatic confirmation.
 */
export async function lookupByEAN(
  ctx: ApiContext,
  params: { ean: string; mainBillCode: string }
): Promise<EANLookupResult> {
  if (USE_DUMMY) {
    const ean = (params.ean || "").trim().toUpperCase();
    const matches = getLinesByBill(params.mainBillCode).filter(
      (raw) => (raw.CODE_EAN || "").trim().toUpperCase() === ean
    );
    // The choice is a model, the identical model/color rows are shown once
    const seen: { [key: string]: boolean } = {};
    const candidates: EANCandidate[] = [];
    matches.forEach((raw) => {
      const key = `${raw.MODEL}|${raw.COLOR_NAME}|${raw.CODE_EAN}`;
      if (seen[key]) return;
      seen[key] = true;
      candidates.push({
        model: raw.MODEL,
        modelDesc: raw.MODEL_DESC,
        colorName: raw.COLOR_NAME,
        ean: raw.CODE_EAN,
      });
    });
    return {
      candidates,
      message:
        candidates.length > 0
          ? `${candidates.length} model(s) found, please select one.`
          : `EAN ${params.ean} not found on this bill.`,
    };
  }
  return remoteLookupByEAN(ctx, params);
}

/**
 * Page 3: submits the return of a product identified by its EAN.
 *
 * The model is the one the operator selected in the list of the EAN page.
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
  if (USE_DUMMY) {
    // the unit is flagged as returned in the store
    console.log("submitReturnWithEAN (dummy):", payload.sn, payload.ean);
    markReturned(payload.sn);
    const counts = getModelCounts(payload.context.f_billCode, payload.context.f_model);
    return {
      success: true,
      actualQty: counts.doneQty,
      planQty: counts.planQty,
      productStatus: counts.doneQty >= counts.planQty ? "BILL FINISHED" : "RETURNED (EAN)",
      billFinished: counts.doneQty >= counts.planQty,
    };
  }
  return remoteSubmitReturnWithEAN(ctx, payload);
}

/**
 * Page 2: the products of the model that were already scanned (dummy only).
 *
 * The real API has no list of the scanned items, the list is kept client side
 * by the SN page.
 */
export async function getReturnedProducts(
  ctx: ApiContext,
  params: { mainBillCode: string; model: string }
): Promise<TraceabilityRecord[]> {
  const lines = getLinesByBill(params.mainBillCode).filter(
    (raw) =>
      (!params.model || raw.MODEL === params.model) &&
      raw.GOODS_MOVEMENT_STATUS === GOODS_MOVEMENT_STATUS_DONE
  );
  return lines.map((raw) => buildTrace(raw));
}

/** True when the product of a traceability record is already confirmed. */
export const isConfirmed = (trace: TraceabilityRecord): boolean =>
  trace.movementStatus === GOODS_MOVEMENT_STATUS_DONE;
