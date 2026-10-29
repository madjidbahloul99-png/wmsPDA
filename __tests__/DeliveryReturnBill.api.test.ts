/**
 * Tests of the API layer of the "Delivery Return Bill" feature.
 *
 * The calls go to the real WMS API (api/DeliveryReturn), a fetch mock plays
 * the server. The answers use the two shapes of the server: the controllers
 * serialize { code, message, data }, the exception middleware serializes
 * { Code, Message, Data }.
 */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  aggregateByModel,
  checkSNTraceability,
  confirmReturn,
  getBillModels,
  getOperateSign,
  API_PATH,
  lookupByEAN,
  mapEANCandidate,
  mapRawLine,
  submitReturnWithEAN,
} from "../src/DeliveryReturnBill/api";
import { ApiContext } from "../src/DeliveryReturnBill/api";
import { ReturnContext, TraceabilityRecord } from "../src/DeliveryReturnBill/types";
import { MD5 } from "../src/pubfunction";
import { DELIVERY_RETURN_BILL_API_KEY } from "../src/utils/deliveryReturnBillConfig";

const ctx: ApiContext = {
  gs_deliveryReturnAPI: "http://localhost",
  gs_wareCode: "DA06-9000",
  gs_userCode: "user",
  gs_userName: "name",
  gs_PasswordSalt: "salt",
  gs_version: "1.0.0",
  gs_classCode: "01",
  gs_IPAddress: "127.0.0.1",
};

const context: ReturnContext = {
  f_billCode: "2026062030",
  f_systemDeliveryCode: "1326168351",
  f_sapMainBillCode: "2026062030",
  f_lineId: "1326168351000021",
  f_model: "43A4200G",
  f_modelDesc: 'TELEVISEUR FHD Android TV 43"',
  f_color: "",
  f_ean: "6130839049193",
  f_brand: "HISENSE",
  f_customerCode: "12000957",
  f_customerName: "SARL BOUGATTOUCHA STANDART His",
  f_cityName: "Setif",
  f_address: "Rotation SETIF-BBA",
  f_customerType: "Distribution",
  f_operatorBatch: "1326168351000021",
  f_wareCode: "DA06-9000",
  f_toWarehouseCode: "",
  f_deliveryDate: "2026-10-13",
  f_movementStatus: "",
  f_movementDate: "",
  f_movementType: "DELIVERY",
  f_planQty: 5,
  f_doneQty: 1,
  f_diffQty: 4,
};

/** One line of the ScanReturnBill answer, the historical sample of the API. */
const SAMPLE_ROW = {
  MAIN_BILL_CODE: "2026062030",
  OUT_BILL_CODE: "1326168354",
  WAREHOUSE_CODE: "DA01-9000",
  TO_WAREHOUSE_CODE: "",
  CUSTOMER_CODE: "12000957",
  CUSTOMER_NAME: "SARL BOUGATTOUCHA STANDART His",
  CITY_CODE: "19",
  CITY_NAME: "Setif",
  ADDRESS: "Rotation SETIF-BBA",
  CUSTOMER_TYPE: "Distribution",
  GUID: "1326168354000060",
  MODEL: "FC-33DT4SAW",
  MODEL_DESC: "CONG HORIZONTAL DF CONV 240 L WHITE",
  COLOR_NAME: "",
  CODE_EAN: "6130839053541",
  BRAND: "HISENSE",
  MATERIAL_TYPE: "",
  DELIVERY_DATE: "2026-10-13",
  BILL_COUNT: 1,
  PRICE_HT: 0,
  GOODS_MOVEMENT_STATUS: "C",
  GOODS_MOVEMENT_DATE: "2026-10-15",
  DELIVERY_OR_ALLOCATEOUT: "RETURN",
};

/** A second line, same model, another customer, not returned yet. */
const SAMPLE_ROW_2 = {
  ...SAMPLE_ROW,
  GUID: "1326168354000061",
  CUSTOMER_CODE: "12000958",
  CUSTOMER_NAME: "SARL ATELIER DE LA MEDINA",
  OUT_BILL_CODE: "1326168355",
  GOODS_MOVEMENT_STATUS: "",
  GOODS_MOVEMENT_DATE: "",
};

/** Installs a fetch answer for the next call. */
const mockFetch = (body: any, status = 200) => {
  (globalThis as any).fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    })
  );
};

describe("DeliveryReturnBill api (real WMS API)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("builds the sign fields of BaseSignInfo", () => {
    const sign = getOperateSign(ctx);
    expect(sign.operateUserCode).toBe("user");
    expect(sign.operateUserName).toBe("name");
    expect(sign.operateWareHouseCode).toBe(ctx.gs_wareCode);
    expect(sign.operateRandomNumber).toBe("2");
    expect(sign.operateVersion).toBe(ctx.gs_version);
    expect(sign.operateSign).toBe(MD5("user" + "name" + "2" + ctx.gs_PasswordSalt));
  });

  it("maps the raw line of the server", () => {
    const line = mapRawLine(SAMPLE_ROW);
    expect(line.lineId).toBe("1326168354000060");
    expect(line.mainBillCode).toBe("2026062030");
    expect(line.outBillCode).toBe("1326168354");
    expect(line.model).toBe("FC-33DT4SAW");
    expect(line.ean).toBe("6130839053541");
    expect(line.movementStatus).toBe("C");
    // plan from BILL_COUNT, done from the "C" status
    expect(line.planQty).toBe(1);
    expect(line.doneQty).toBe(1);
  });

  it("maps a pending line from the lowercase plan columns", () => {
    const line = mapRawLine({
      id: 4012,
      model: "H17KBKS5",
      deliveryCode: "1326168356",
      qty: 1,
      qtyOk: 1,
      goodsMovementStatus: "C",
    });
    // the planId is the id when the answer exposes it, done comes from qtyOk
    expect(line.lineId).toBe("4012");
    expect(line.planQty).toBe(1);
    expect(line.doneQty).toBe(1);
    expect(line.outBillCode).toBe("1326168356");
  });

  it("groups the lines of the bill by model, one row per customer", () => {
    const groups = aggregateByModel(
      [SAMPLE_ROW, SAMPLE_ROW_2].map((raw) => mapRawLine(raw))
    );
    expect(groups.length).toBe(1);

    const group = groups[0];
    expect(group.model).toBe("FC-33DT4SAW");
    expect(group.planQty).toBe(2);
    expect(group.doneQty).toBe(1);
    expect(group.diffQty).toBe(1);
    expect(group.rows.length).toBe(2);

    const first = group.rows[0];
    expect(first.customerCode).toBe("12000957");
    expect(first.doneQty).toBe(1);

    const second = group.rows[1];
    expect(second.customerCode).toBe("12000958");
    expect(second.planQty).toBe(1);
    expect(second.doneQty).toBe(0);
    expect(second.systemDeliveryCode).toBe("1326168355");
  });

  it("scans a return bill, signs the request and maps the answer", async () => {
    mockFetch({ code: 200, message: "success", data: [SAMPLE_ROW, SAMPLE_ROW_2] });

    const groups = await getBillModels(ctx, { sapMainBillCode: "2026062030" });
    expect(groups.length).toBe(1);
    expect(groups[0].rows.length).toBe(2);

    // the request carried the path, the parameters and the operate* sign
    const url = decodeURIComponent((globalThis as any).fetch.mock.calls[0][0]);
    expect(url).toContain(`${ctx.gs_deliveryReturnAPI}${API_PATH}/ScanReturnBill?`);
    expect(url).toContain("returnBillCode=2026062030");
    expect(url).toContain(`warehouseCode=${ctx.gs_wareCode}`);
    expect(url).toContain("operateUserCode=user");
    expect(url).toContain("operateUserName=name");
    expect(url).toContain("operateRandomNumber=2");
    expect(url).toContain(`operateSign=${MD5("user" + "name" + "2" + "salt")}`);
    expect(url).toContain(`operateVersion=${ctx.gs_version}`);

    // Delivery Return Bill uses the configured static header; JWT is not required.
    const options = (globalThis as any).fetch.mock.calls[0][1];
    expect(options.method).toBe("GET");
    expect(options.headers["X-Api-Key"]).toBe(DELIVERY_RETURN_BILL_API_KEY);
    expect(options.headers["Authorization"]).toBeUndefined();
  });

  it("asks to log in again on HTTP 401", async () => {
    mockFetch({}, 401);

    await expect(
      getBillModels(ctx, { sapMainBillCode: "2026062030" })
    ).rejects.toThrow("Session expired, please log in again");
  });

  it("surfaces the message of the warehouse check of the server", async () => {
    mockFetch({ Code: 404, Message: "No model found for this bill in your warehouse" });

    await expect(
      getBillModels(ctx, { sapMainBillCode: "2026062030" })
    ).rejects.toThrow("No model found for this bill in your warehouse");
  });

  it("maps the traceability of a found SN (result A)", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: {
        isok: "1",
        result: "A",
        sn: "KLE0535030012055",
        traceabilityExists: true,
        model: "43A4200G",
        outBillCode: "1326168354",
        sapMainBillCode: "2026062030",
        sapUuid: "SAPUUID-1",
        message: "Delivery found",
      },
    });

    const result = await checkSNTraceability(ctx, {
      sn: "KLE0535030012055",
      modelCode: "43A4200G",
      returnBillCode: "2026062030",
      warehouseCode: "DA06-9000",
    });
    expect(result.result).toBe("A");
    expect(result.isok).toBe("1");
    expect(result.model).toBe("43A4200G");
    expect(result.found).toBe(true);
    expect(result.traces.length).toBe(1);
    expect(result.traces[0].model).toBe("43A4200G");
    expect(result.traces[0].outBillCode).toBe("1326168354");
    expect(result.traces[0].sapMainBillCode).toBe("2026062030");
    expect(result.traces[0].sapUuid).toBe("SAPUUID-1");
    expect(result.requiresEan).toBeFalsy();

    const url = decodeURIComponent((globalThis as any).fetch.mock.calls[0][0]);
    expect(url).toContain(`${API_PATH}/ValidateProductSN?`);
    expect(url).toContain("sn=KLE0535030012055");
    expect(url).toContain("modelCode=43A4200G");
    expect(url).toContain("returnBillCode=2026062030");
    expect(url).toContain("warehouseCode=DA06-9000");
  });

  it("asks for the EAN when the SN has no delivery (result D)", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: {
        isok: "1",
        result: "D",
        sn: "KLE0535030012055",
        traceabilityExists: false,
        message: "SN not found, please scan the EAN",
      },
    });

    const result = await checkSNTraceability(ctx, {
      sn: "KLE0535030012055",
      modelCode: "43A4200G",
      returnBillCode: "2026062030",
      warehouseCode: "DA06-9000",
    });
    expect(result.result).toBe("D");
    expect(result.found).toBe(false);
    expect(result.traces.length).toBe(0);
    expect(result.requiresEan).toBe(true);
    expect(result.error).toBe("SN not found, please scan the EAN");
  });

  it("keeps the operator on the page for a model of the bill (result B, isok 0)", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: {
        isok: "0",
        result: "B",
        sn: "KLE0535030012055",
        traceabilityExists: true,
        model: "43A4200H",
        message:
          "This SN is model 43A4200H, please select that model in the return bill.",
      },
    });

    const result = await checkSNTraceability(ctx, {
      sn: "KLE0535030012055",
      modelCode: "43A4200G",
      returnBillCode: "2026062030",
      warehouseCode: "DA06-9000",
    });
    // Business status answered with HTTP 200: no exception, no confirm page
    expect(result.result).toBe("B");
    expect(result.isok).toBe("0");
    expect(result.found).toBe(false);
    expect(result.requiresEan).toBe(false);
    expect(result.traces.length).toBe(0);
    expect(result.message).toContain("43A4200H");
  });

  it("keeps the operator on the page for a model outside the bill (result C)", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: {
        isok: "0",
        result: "C",
        sn: "KLE0535030012055",
        traceabilityExists: true,
        model: "43A4200Z",
        message: "This SN is model 43A4200Z, this model is not in the return bill.",
      },
    });

    const result = await checkSNTraceability(ctx, {
      sn: "KLE0535030012055",
      modelCode: "43A4200G",
      returnBillCode: "2026062030",
      warehouseCode: "DA06-9000",
    });
    expect(result.result).toBe("C");
    expect(result.found).toBe(false);
    expect(result.requiresEan).toBe(false);
    expect(result.message).toContain("not in the return bill");
  });

  it("routes an older answer without result on traceabilityExists", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: {
        traceabilityExists: true,
        model: "43A4200G",
      },
    });

    const result = await checkSNTraceability(ctx, {
      sn: "KLE0535030012055",
      modelCode: "43A4200G",
      returnBillCode: "2026062030",
      warehouseCode: "DA06-9000",
    });
    expect(result.result).toBe("");
    expect(result.found).toBe(true);
  });

  it("surfaces the errors of the server", async () => {
    mockFetch({
      Code: 400,
      Message: "sn, modelCode, returnBillCode and warehouseCode are required",
    });

    await expect(
      checkSNTraceability(ctx, {
        sn: "KLE0535030012055",
        modelCode: "43A4200G",
        returnBillCode: "2026062030",
        warehouseCode: "DA06-9000",
      })
    ).rejects.toThrow(
      "sn, modelCode, returnBillCode and warehouseCode are required"
    );
  });

  it("maps the models of the EAN lookup and shows identical rows once", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: [
        { model: "43A4200G", modelDesc: "FHD TV 43", colorName: "", ean: "6130839053541", isSelected: true },
        { model: "43A4200G", modelDesc: "FHD TV 43", colorName: "", ean: "6130839053541", isSelected: true },
        { model: "43A4200H", modelDesc: "FHD TV 43", colorName: "BLACK", ean: "6130839053541", isSelected: false },
      ],
    });

    const result = await lookupByEAN(ctx, {
      ean: "6130839053541",
      modelCode: "43A4200G",
    });
    // the duplicated row of the answer is shown once, the color differs
    expect(result.candidates.length).toBe(2);
    expect(result.candidates[0].model).toBe("43A4200G");
    expect(result.candidates[0].colorName).toBe("");
    expect(result.candidates[0].isSelected).toBe(true);
    expect(result.candidates[1].model).toBe("43A4200H");
    expect(result.candidates[1].colorName).toBe("BLACK");
    expect(result.candidates[1].ean).toBe("6130839053541");
    expect(result.candidates[1].isSelected).toBe(false);

    const url = decodeURIComponent((globalThis as any).fetch.mock.calls[0][0]);
    expect(url).toContain(`${API_PATH}/CheckEAN?`);
    expect(url).toContain("ean=6130839053541");
    expect(url).toContain("modelCode=43A4200G");

    expect(mapEANCandidate({ MODEL: "X", MODEL_DESC: "Y", CODE_EAN: "1" }).model).toBe("X");
    expect(mapEANCandidate({ MODEL: "X", isSelected: true }).isSelected).toBe(true);
    expect(mapEANCandidate({ MODEL: "X" }).isSelected).toBe(false);
  });

  it("saves the return of a traced SN (JSON body, TRACE)", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: {
        returnBillCode: "2026062030",
        sn: "KLE0535030012055",
        model: "43A4200G",
        qty: 6,
        qtyOk: 2,
        billFinished: false,
      },
    });

    const trace: TraceabilityRecord = {
      sn: "KLE0535030012055",
      lineId: "",
      mainBillCode: "",
      outBillCode: "1326168354",
      sapMainBillCode: "SAPBILL-1",
      sapUuid: "SAPUUID-1",
      model: "43A4200G",
      modelDesc: "",
      color: "",
      ean: "",
      brand: "",
      customerCode: "",
      customerName: "",
      warehouseCode: "",
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

    const result = await confirmReturn(ctx, {
      context: context,
      sn: "KLE0535030012055",
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.planQty).toBe(6);
    expect(result.actualQty).toBe(2);
    expect(result.billFinished).toBe(false);

    // the POST carries the JSON body of SaveReturnDetailRequest
    const [url, options] = (globalThis as any).fetch.mock.calls[0];
    expect(url).toBe(`${ctx.gs_deliveryReturnAPI}${API_PATH}/SaveReturnDetail`);
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["X-Api-Key"]).toBe(DELIVERY_RETURN_BILL_API_KEY);
    expect(options.headers["Authorization"]).toBeUndefined();

    const body = JSON.parse(options.body);
    expect(body.returnBillCode).toBe("2026062030");
    expect(body.planId).toBe("1326168351000021");
    expect(body.warehouseCode).toBe(ctx.gs_wareCode);
    expect(body.sn).toBe("KLE0535030012055");
    expect(body.model).toBe("43A4200G");
    expect(body.scanType).toBe("TRACE");
    expect(body.outBillCode).toBe("1326168354");
    expect(body.sapMainBillCode).toBe("SAPBILL-1");
    expect(body.sapUuid).toBe("SAPUUID-1");
    expect(body.operateUserCode).toBe("user");
    expect(body.operateSign).toBe(MD5("user" + "name" + "2" + "salt"));
  });

  it("saves the return identified by the EAN (JSON body, EAN)", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: {
        returnBillCode: "2026062030",
        sn: "KLE0535030012055",
        model: "43A4200H",
        qty: 2,
        qtyOk: 2,
        billFinished: true,
      },
    });

    const result = await submitReturnWithEAN(ctx, {
      context: context,
      sn: "KLE0535030012055",
      ean: "6130839053541",
      model: "43A4200H",
    });

    expect(result.success).toBe(true);
    expect(result.planQty).toBe(2);
    expect(result.actualQty).toBe(2);
    expect(result.billFinished).toBe(true);
    expect(result.productStatus).toBe("BILL FINISHED");

    const [, options] = (globalThis as any).fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.scanType).toBe("EAN");
    expect(body.ean).toBe("6130839053541");
    // the model of the operator selection, not the context model
    expect(body.model).toBe("43A4200H");
    expect(body.userCode).toBe("user");
  });

  it("surfaces the server errors of the save", async () => {
    mockFetch({
      Code: 400,
      Message: "SN already scanned in this return bill",
    });

    await expect(
      confirmReturn(ctx, { context: context, sn: "1326168351000021" })
    ).rejects.toThrow("SN already scanned in this return bill");

    mockFetch({
      Code: 400,
      Message: "This model is already completed",
    });

    await expect(
      confirmReturn(ctx, { context: context, sn: "1326168351000021" })
    ).rejects.toThrow("This model is already completed");
  });
});
