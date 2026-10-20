/**
 * API layer of the "Delivery Return Bill" feature.
 *
 * The backend endpoints of this feature are not ready yet, therefore every call
 * of the public API returns local dummy data (see mockData.ts). The real
 * requests are implemented in the "remote*" functions, they are compiled and
 * type checked, they are simply not called yet. As soon as the backend is
 * ready, the matching line of the public function is uncommented:
 *
 *   getBillModels      -> remoteGetBillModels
 *   getModelEAN        -> remoteGetModelEAN
 *   checkSNTraceability-> remoteCheckSNTraceability
 *   confirmReturn      -> remoteConfirmReturn
 *   submitReturnWithEAN-> remoteSubmitReturnWithEAN
 *
 * All requests follow the conventions of the other screens of the app:
 *   - MD5 user signature (pubfunction.SetUserSignInfo / pubfunction.GetUserSign)
 *   - Content-Type: application/x-www-form-urlencoded
 *   - barcodes escaped with pubfunction.PostSpecialStr
 */

import * as pubfunction from "../pubfunction";
import {
  BillModelRow,
  ReturnContext,
  ReturnResult,
  TraceabilityCheckResult,
  TraceabilityRecord,
} from "./types";
import {
  MOCK_BILL_MODELS,
  MOCK_MODEL_EAN,
  MOCK_TRACEABILITY,
} from "./mockData";

/** Bill type of a delivery return. */
export const BILL_TYPE_RETURN = "5003";

/** Work station type used by the return stock-in. */
export const WORK_STATION_TYPE_RETURN = "deliveryReturn";

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

/** Builds the x-www-form-urlencoded body of a signed request. */
const buildFormBody = (signedQo: Record<string, any>): string =>
  Object.keys(signedQo)
    .map((key) => {
      const value = signedQo[key];
      const str = value === null || value === undefined ? "" : String(value);
      return encodeURIComponent(key) + "=" + encodeURIComponent(str);
    })
    .join("&");

/** Signs the request model with the user signature. */
const sign = (ctx: ApiContext, model: Record<string, any>) =>
  pubfunction.SetUserSignInfo(
    model,
    ctx.gs_userCode,
    ctx.gs_userName,
    "2",
    ctx.gs_PasswordSalt,
    ctx.gs_version,
    "en_US"
  );

/** Reads the list of a response, it can be an array or a json string. */
const readList = (resData: any): any[] => {
  if (!resData) return [];
  if (Array.isArray(resData.list)) return resData.list;
  if (typeof resData.list === "string") {
    try {
      const parsed = JSON.parse(resData.list);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

/** Maps a traceability payload of the server to the local model. */
export const mapTraceability = (data: any, sn: string): TraceabilityRecord => ({
  sn: data.sn || data.scanBarCode || sn || "",
  model: data.model || "",
  color: data.color || "",
  palletCode: data.palletCode || "",
  boxCode: data.boxCode || "",
  imei1: data.imei1 || data.imeiCode1 || "",
  imei2: data.imei2 || data.imeiCode2 || "",
  imei3: data.imei3 || data.imeiCode3 || "",
  deliveryDate: data.deliveryDate || data.realDate || "",
  ean: (data.ean || "").toUpperCase().trim(),
  productStatus: data.productStatus || data.status || "",
  warehouseCode: data.warehouseCode || "",
  customerCode: data.customerCode || "",
});

/* ==========================================================================
   Real requests
   ========================================================================== */

/**
 * Loads the models of the scanned SAP return bill.
 */
export async function remoteGetBillModels(
  ctx: ApiContext,
  params: { sapMainBillCode: string }
): Promise<BillModelRow[]> {
  try {
    let urlCur = `${ctx.gs_BaseURL}/warehouse/billInfo/getDeliveryNotSignReturnWarehouseBillInfoByBillCodeFromSap`;
    urlCur = urlCur + `?sapMainBillCode=${encodeURIComponent(params.sapMainBillCode)}`;
    urlCur = urlCur + `&warehouseCode=${encodeURIComponent(ctx.gs_wareCode)}`;
    urlCur = urlCur + `&billType=${encodeURIComponent(BILL_TYPE_RETURN)}`;
    urlCur = urlCur + pubfunction.GetUserSign("&");

    const response = await fetch(urlCur, {
      method: "GET",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!response.ok) {
      pubfunction.ShowError(`HTTP Error: ${response.status}`);
      return [];
    }

    const resData = await response.json();
    if (!resData || !resData.success) {
      pubfunction.ShowError((resData && resData.msg) || "Loading failed");
      return [];
    }

    let fromck = "";
    let supplierCode = "";
    const rawList = readList(resData);
    if (rawList.length > 0) {
      fromck = rawList[0].warehouseCode || "";
      supplierCode = rawList[0].supplierCode || "";
    }

    return rawList.map((item: any, idx: number) => {
      const planQty = parseInt(item.hasDeliveryCount || "0") || 0;
      const doneQty = parseInt(item.actualCount || "0") || 0;
      return {
        id: String(idx),
        systemDeliveryCode: item.billCode || "",
        deliveryCode: item.operatorBatch || "",
        model: item.model || "",
        color: item.color || "",
        supplierCode: item.supplierCode || supplierCode,
        operatorBatch: item.operatorBatch || "",
        sapMainBillCode: params.sapMainBillCode,
        fromck: item.warehouseCode || fromck,
        planQty,
        doneQty,
        diffQty: planQty - doneQty,
      };
    });
  } catch (err: any) {
    pubfunction.ShowError(err.message || "Network error");
    return [];
  }
}

/**
 * EAN of a model, used to validate the EAN scanned on the EAN page.
 */
export async function remoteGetModelEAN(
  ctx: ApiContext,
  model: string
): Promise<string> {
  try {
    const urlCur = `${ctx.gs_BaseURL}/basedata/model/getListByCondition`;
    const signedQo = sign(ctx, { model: model || "" });

    const response = await fetch(urlCur, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildFormBody(signedQo),
    });

    if (!response.ok) {
      pubfunction.ShowError(`HTTP Error: ${response.status}`);
      return "";
    }

    const resData = await response.json();
    const rawList = readList(resData);
    if (rawList.length > 0) {
      return (rawList[0].ean || "").toUpperCase().trim();
    }
    return "";
  } catch (err: any) {
    pubfunction.ShowError(err.message || "Network error");
    return "";
  }
}

/**
 * Checks whether the scanned SN has a delivery traceability.
 *
 * The backend endpoint does not exist yet, the expected request is a POST on
 * /warehouse/billInfo/... with the bill code, the model and the scanned SN,
 * signed like every other request. As soon as the endpoint is known, only the
 * body of this function has to be completed.
 */
export async function remoteCheckSNTraceability(
  ctx: ApiContext,
  params: { sn: string; billCode: string; model: string }
): Promise<TraceabilityCheckResult> {
  try {
    // TODO: the delivery traceability endpoint is not available yet.
    // const urlCur = `${ctx.gs_BaseURL}/warehouse/billInfo/<delivery traceability endpoint>`;
    // const signedQo = sign(ctx, {
    //   billCode: params.billCode || "",
    //   billType: BILL_TYPE_RETURN,
    //   warehouseCode: ctx.gs_wareCode,
    //   model: params.model || "",
    //   scanBarCode: pubfunction.PostSpecialStr(params.sn || ""),
    //   scanBarCodeType: "SN",
    // });
    // const response = await fetch(urlCur, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/x-www-form-urlencoded" },
    //   body: buildFormBody(signedQo),
    // });
    // const resData = await response.json();
    // if (resData && resData.success && resData.data) {
    //   return { found: true, trace: mapTraceability(resData.data, params.sn) };
    // }
    // return {
    //   found: false,
    //   error: (resData && resData.msg) || `No delivery traceability found for SN ${params.sn}`,
    // };

    return {
      found: false,
      error: `No delivery traceability found for SN ${params.sn}`,
    };
  } catch (err: any) {
    return {
      found: false,
      error: err.message || `No delivery traceability found for SN ${params.sn}`,
    };
  }
}

/**
 * Confirms the return of a product that has a delivery traceability.
 * The product is added back to the stock and the processed quantity is updated.
 */
export async function remoteConfirmReturn(
  ctx: ApiContext,
  payload: {
    context: ReturnContext;
    sn: string;
    ean?: string;
    trace?: TraceabilityRecord;
  }
): Promise<ReturnResult> {
  const { context, sn } = payload;

  try {
    const urlCur = `${ctx.gs_BaseURL}/warehouse/billInfo/doNotSignWarehouseInStorage`;
    const qo = {
      billCode: context.f_systemDeliveryCode,
      billType: BILL_TYPE_RETURN,
      warehouseCode: ctx.gs_wareCode,
      customerCode: context.f_customerCode,
      storageCode: "",
      scanBarCode: pubfunction.PostSpecialStr(sn),
      scanBarCodeType: "SN",
      scanCount: "",
      materialCode: context.f_model,
      operatorBatch: context.f_operatorBatch,
      classCode: ctx.gs_classCode || "01",
      remark: payload.ean || "",
      workStationType: WORK_STATION_TYPE_RETURN,
      sapMainBillCode: context.f_sapMainBillCode,
      deviceIp: ctx.gs_IPAddress,
    };

    const signedQo = sign(ctx, qo);
    const response = await fetch(urlCur, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: buildFormBody(signedQo),
    });

    if (!response.ok) {
      pubfunction.ShowError(`HTTP Error: ${response.status}`);
      return { success: false, msg: `HTTP Error: ${response.status}` };
    }

    const resData = await response.json();
    if (!resData || !resData.success) {
      const msg = (resData && resData.msg) || "Save barcode error";
      pubfunction.ShowError(msg);
      return { success: false, msg };
    }

    const vo = typeof resData.data === "string" ? JSON.parse(resData.data) : resData.data;
    const planQty = parseInt(vo?.receiptCount?.hasDeliveryCount || "0") || 0;
    const actualQty = parseInt(vo?.receiptCount?.allReceiptCount || "0") || 0;

    return {
      success: true,
      actualQty,
      planQty,
      productStatus: (vo && vo.productStatus) || "",
    };
  } catch (err: any) {
    const msg = err.message || "Network error";
    pubfunction.ShowError(msg);
    return { success: false, msg };
  }
}

/**
 * Submits the return of a product without delivery traceability.
 * The EAN scanned on the EAN page is sent together with the SN, there is no
 * confirmation screen for this branch, the submission is automatic.
 */
export async function remoteSubmitReturnWithEAN(
  ctx: ApiContext,
  payload: {
    context: ReturnContext;
    sn: string;
    ean: string;
  }
): Promise<ReturnResult> {
  // TODO: the backend endpoint for a return without traceability is not
  // available yet. The expected request is a POST on /warehouse/billInfo/...
  // with the SN and the EAN, signed like every other request.
  // const urlCur = `${ctx.gs_BaseURL}/warehouse/billInfo/<return with EAN endpoint>`;
  // const signedQo = sign(ctx, {
  //   billCode: payload.context.f_systemDeliveryCode,
  //   billType: BILL_TYPE_RETURN,
  //   warehouseCode: ctx.gs_wareCode,
  //   customerCode: payload.context.f_customerCode,
  //   materialCode: payload.context.f_model,
  //   operatorBatch: payload.context.f_operatorBatch,
  //   scanBarCode: pubfunction.PostSpecialStr(payload.sn),
  //   ean: payload.ean,
  //   classCode: ctx.gs_classCode || "01",
  //   workStationType: WORK_STATION_TYPE_RETURN,
  //   sapMainBillCode: payload.context.f_sapMainBillCode,
  //   deviceIp: ctx.gs_IPAddress,
  // });
  // const response = await fetch(urlCur, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/x-www-form-urlencoded" },
  //   body: buildFormBody(signedQo),
  // });
  // const resData = await response.json();
  // if (!resData || !resData.success) {
  //   const msg = (resData && resData.msg) || "Save barcode error";
  //   pubfunction.ShowError(msg);
  //   return { success: false, msg };
  // }
  // return { success: true, actualQty: ..., planQty: ..., productStatus: ... };

  console.log(
    "remoteSubmitReturnWithEAN (endpoint not available yet):",
    ctx.gs_BaseURL,
    payload.sn,
    payload.ean
  );
  return { success: true };
}

/* ==========================================================================
   Public API, dummy data while the backend is not ready
   ========================================================================== */

/**
 * Page 1: loads the models of the scanned SAP return bill.
 */
export async function getBillModels(
  ctx: ApiContext,
  params: { sapMainBillCode: string }
): Promise<BillModelRow[]> {
  // TODO: the backend is ready, use the real request
  // return remoteGetBillModels(ctx, params);

  // Dummy data (backend not ready yet)
  console.log("getBillModels (dummy):", params.sapMainBillCode, ctx.gs_wareCode);
  return MOCK_BILL_MODELS.map((row) => ({ ...row }));
}

/**
 * EAN of a model, used to validate the EAN scanned on the EAN page.
 */
export async function getModelEAN(ctx: ApiContext, model: string): Promise<string> {
  // TODO: the backend is ready, use the real request
  // return remoteGetModelEAN(ctx, model);

  // Dummy data (backend not ready yet)
  console.log("getModelEAN (dummy):", model, ctx.gs_wareCode);
  return (MOCK_MODEL_EAN[model] || "").toUpperCase().trim();
}

/**
 * Page 2: checks whether the scanned SN has a delivery traceability.
 *
 * When the traceability is found the operator goes straight to the confirm
 * page, when the lookup fails the EAN has to be scanned (EAN page).
 */
export async function checkSNTraceability(
  ctx: ApiContext,
  params: { sn: string; billCode: string; model: string }
): Promise<TraceabilityCheckResult> {
  // TODO: the backend is ready, use the real request
  // return remoteCheckSNTraceability(ctx, params);

  // Dummy data (backend not ready yet): only SN0001 / SN0002 have a traceability
  console.log("checkSNTraceability (dummy):", params.sn, ctx.gs_wareCode);
  const trace: TraceabilityRecord | undefined = MOCK_TRACEABILITY[params.sn];
  if (!trace) {
    return {
      found: false,
      error: `No delivery traceability found for SN ${params.sn}`,
    };
  }
  return { found: true, trace: { ...trace } };
}

/**
 * Page 4: confirms the return of a product that has a delivery traceability.
 */
export async function confirmReturn(
  ctx: ApiContext,
  payload: {
    context: ReturnContext;
    sn: string;
    ean?: string;
    trace?: TraceabilityRecord;
  }
): Promise<ReturnResult> {
  // TODO: the backend is ready, use the real request
  // return remoteConfirmReturn(ctx, payload);

  // Dummy data (backend not ready yet)
  console.log("confirmReturn (dummy):", payload.sn, ctx.gs_wareCode);
  return {
    success: true,
    actualQty: payload.context.f_doneQty + 1,
    planQty: payload.context.f_planQty,
    productStatus: "RETURNED",
  };
}

/**
 * Page 3: submits the return of a product without delivery traceability,
 * the submission is automatic (no confirmation screen).
 */
export async function submitReturnWithEAN(
  ctx: ApiContext,
  payload: {
    context: ReturnContext;
    sn: string;
    ean: string;
  }
): Promise<ReturnResult> {
  // TODO: the backend is ready, use the real request
  // return remoteSubmitReturnWithEAN(ctx, payload);

  // Dummy data (backend not ready yet)
  console.log("submitReturnWithEAN (dummy):", payload.sn, payload.ean, ctx.gs_wareCode);
  return {
    success: true,
    actualQty: payload.context.f_doneQty + 1,
    planQty: payload.context.f_planQty,
    productStatus: "RETURNED (EAN)",
  };
}
