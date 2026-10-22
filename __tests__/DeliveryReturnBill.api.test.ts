jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  aggregateByModel,
  checkSNTraceability,
  confirmReturn,
  getBillModels,
  getModelCounts,
  getModelEAN,
  getReturnedProducts,
  getScanBarCodeDetails,
  isConfirmed,
  lookupByEAN,
  mapRawLine,
  setMockMode,
  getOperateSign,
  API_PATH,
  submitReturnWithEAN,
} from "../src/DeliveryReturnBill/api";
import { ApiContext } from "../src/DeliveryReturnBill/api";
import { ReturnContext } from "../src/DeliveryReturnBill/types";
import { resetStore } from "../src/DeliveryReturnBill/mockStore";
import { MOCK_BILL_LINES } from "../src/DeliveryReturnBill/mockData";
import { MD5 } from "../src/pubfunction";

const ctx: ApiContext = {
  gs_BaseURL: "http://localhost",
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
  f_movementStatus: "O",
  f_movementDate: "",
  f_movementType: "DELIVERY",
  f_planQty: 5,
  f_doneQty: 1,
  f_diffQty: 4,
};

beforeEach(() => {
  resetStore();
});

describe("DeliveryReturnBill api (dummy data)", () => {
  it("maps the raw line of the server", () => {
    const line = mapRawLine(MOCK_BILL_LINES[0]);
    expect(line.mainBillCode).toBe("2026062030");
    expect(line.outBillCode).toBe("1326168351");
    expect(line.model).toBe("43A4200G");
    expect(line.ean).toBe("6130839049193");
    expect(line.movementStatus).toBe("C");
    expect(line.movementType).toBe("RETURN");
  });

  it("groups the lines of the bill by model with the quantities", () => {
    const groups = aggregateByModel(MOCK_BILL_LINES.map(mapRawLine));
    const group = groups.find((g) => g.model === "43A4200G");
    expect(group).toBeTruthy();
    // 6 units of that model, 1 of them already returned
    expect(group?.planQty).toBe(6);
    expect(group?.doneQty).toBe(1);
    expect(group?.diffQty).toBe(5);
  });

  it("keeps one row per customer of a model (multi client)", () => {
    const groups = aggregateByModel(MOCK_BILL_LINES.map(mapRawLine));
    const group = groups.find((g) => g.model === "43A4200G");
    expect(group?.rows.length).toBe(2);

    const first = group?.rows.find((r) => r.customerCode === "12000957");
    const second = group?.rows.find((r) => r.customerCode === "12000958");
    expect(first?.planQty).toBe(5);
    expect(first?.doneQty).toBe(1);
    expect(second?.planQty).toBe(1);
    expect(second?.doneQty).toBe(0);
    expect(second?.customerName).toBe("SARL ATELIER DE LA MEDINA");
  });

  it("loads the models of the scanned bill", async () => {
    const groups = await getBillModels(ctx, { sapMainBillCode: "2026062030" });
    // 43A4200G, 43A4200H, 43A4200K, 43A4200L
    expect(groups.length).toBe(4);

    const group = groups.find((g) => g.model === "43A4200G");
    expect(group?.planQty).toBe(6);
    expect(group?.rows.length).toBe(2);

    const other = groups.find((g) => g.model === "43A4200L");
    expect(other?.rows[0].customerCode).toBe("12000958");
    expect(other?.rows[0].systemDeliveryCode).toBe("1326168353");
  });

  it("returns no model for an unknown bill", async () => {
    const rows = await getBillModels(ctx, { sapMainBillCode: "UNKNOWN" });
    expect(rows.length).toBe(0);
  });

  it("returns the EAN of the model", async () => {
    expect(await getModelEAN(ctx, "43A4200G")).toBe("6130839049193");
  });

  it("finds the traceability of a delivered SN", async () => {
    const result = await checkSNTraceability(ctx, {
      sn: "1326168351000021",
      mainBillCode: "2026062030",
      model: "43A4200G",
    });
    expect(result.found).toBe(true);
    expect(result.traces.length).toBe(1);
    expect(result.traces[0].movementType).toBe("DELIVERY");
    expect(result.traces[0].model).toBe("43A4200G");
  });

  it("returns an error for a SN without traceability", async () => {
    const result = await checkSNTraceability(ctx, {
      sn: "UNKNOWN-SN",
      mainBillCode: "2026062030",
      model: "43A4200G",
    });
    expect(result.found).toBe(false);
    expect(result.traces.length).toBe(0);
    expect(result.error).toContain("UNKNOWN-SN");
  });

  it("returns an error for a SN without movement traceability", async () => {
    const result = await checkSNTraceability(ctx, {
      sn: "1326168351000040",
      mainBillCode: "2026062030",
      model: "43A4200K",
    });
    expect(result.found).toBe(false);
    expect(result.traces.length).toBe(0);
    expect(result.error).toContain("not found");
    // the product was not found -> the EAN has to be scanned
    expect(result.requiresEan).toBe(true);
  });

  it("asks for the EAN when the product is not found", async () => {
    // a SN of another model
    const otherModel = await checkSNTraceability(ctx, {
      sn: "1326168353000060",
      mainBillCode: "2026062030",
      model: "43A4200G",
    });
    expect(otherModel.found).toBe(false);
    expect(otherModel.requiresEan).toBe(true);

    // a SN of another bill
    const otherBill = await checkSNTraceability(ctx, {
      sn: "1326168353000010",
      mainBillCode: "2026062030",
      model: "H17KBKS5",
    });
    expect(otherBill.found).toBe(false);
    expect(otherBill.requiresEan).toBe(true);

    // an unknown SN
    const unknown = await checkSNTraceability(ctx, {
      sn: "UNKNOWN-SN",
      mainBillCode: "2026062030",
      model: "43A4200G",
    });
    expect(unknown.found).toBe(false);
    expect(unknown.requiresEan).toBe(true);
  });

  it("tells the operator that a product was already scanned", async () => {
    const result = await checkSNTraceability(ctx, {
      sn: "1326168351000020",
      mainBillCode: "2026062030",
      model: "43A4200G",
    });
    expect(result.found).toBe(false);
    expect(result.alreadyScanned).toBe(true);
    expect(result.requiresEan).toBeFalsy();
    expect(result.error).toContain("already scanned");
  });

  it("loads the physical details of the scanned barcode", async () => {
    const details = await getScanBarCodeDetails(ctx, {
      billCode: context.f_systemDeliveryCode,
      sn: "1326168351000021",
      model: context.f_model,
    });
    expect(details.palletCode).toBe("PL1326168351");
    expect(details.imei1).toBe("860111111111112");
  });

  it("loads the products that were already scanned", async () => {
    const products = await getReturnedProducts(ctx, {
      mainBillCode: "2026062030",
      model: "43A4200G",
    });

    // only the confirmed unit of the model is in the list
    expect(products.length).toBe(1);
    expect(products[0].sn).toBe("1326168351000020");
    expect(isConfirmed(products[0])).toBe(true);
  });

  it("fetches the EAN candidates from the dummy store", async () => {
    // one product with that EAN -> one candidate
    const one = await lookupByEAN(ctx, {
      ean: "6130839049216",
      mainBillCode: "2026062030",
    });
    expect(one.candidates.length).toBe(1);
    expect(one.candidates[0].model).toBe("43A4200K");

    // several products with that EAN -> the identical model rows are shown once
    const several = await lookupByEAN(ctx, {
      ean: "6130839049193",
      mainBillCode: "2026062030",
    });
    // 6 lines of the bill carry that EAN, they are all the same model
    expect(several.candidates.length).toBe(1);
    expect(several.candidates[0].model).toBe("43A4200G");
    expect(several.candidates[0]).toHaveProperty("modelDesc");
    expect(several.candidates[0]).toHaveProperty("colorName");
    expect(several.candidates[0]).toHaveProperty("ean");
  });

  it("does not find an unknown EAN", async () => {
    const result = await lookupByEAN(ctx, {
      ean: "0000000000000",
      mainBillCode: "2026062030",
    });
    expect(result.candidates.length).toBe(0);
    expect(result.message).toContain("not found");
  });

  it("carries the destination warehouse of the bill", async () => {
    const groups = await getBillModels(ctx, { sapMainBillCode: "2026062030" });
    const row = groups[0].rows[0];
    expect(row.toWarehouseCode).toBe("SNTP-ELEC");
    expect(row.fromck).toBe("SNTP-ELEC");

    // the bill of another destination, it is refused by the warehouse check
    const other = await getBillModels(ctx, { sapMainBillCode: "2026062032" });
    expect(other[0].rows[0].toWarehouseCode).toBe("DA99-0000");

    // a bill without destination, the delivery warehouse is used
    const noDestination = await getBillModels(ctx, {
      sapMainBillCode: "2026062033",
    });
    expect(noDestination[0].rows[0].toWarehouseCode).toBe("");
    expect(noDestination[0].rows[0].fromck).toBe("DA03-9000");
    expect(noDestination.length).toBe(4);
  });

  it("returns one traceability record for a scanned SN", async () => {
    // the lookup is scoped to the bill and the model that are processed
    const result = await checkSNTraceability(ctx, {
      sn: "1326168353000060",
      mainBillCode: "2026062030",
      model: "43A4200L",
    });
    expect(result.found).toBe(true);
    expect(result.traces.length).toBe(1);

    // the same code of another model is not found
    const other = await checkSNTraceability(ctx, {
      sn: "1326168353000060",
      mainBillCode: "2026062030",
      model: "43A4200G",
    });
    expect(other.found).toBe(false);
    expect(other.traces.length).toBe(0);
    expect(other.error).toContain("43A4200L");
  });

  it("finds a SN of another customer of the same model and bill", async () => {
    // 43A4200G of the second customer (delivery bill 1326168353)
    const result = await checkSNTraceability(ctx, {
      sn: "1326168353000062",
      mainBillCode: "2026062030",
      model: "43A4200G",
    });
    expect(result.found).toBe(true);
    expect(result.traces.length).toBe(1);
    expect(result.traces[0].customerCode).toBe("12000958");
  });

  it("refuses a SN of another return bill", async () => {
    const result = await checkSNTraceability(ctx, {
      sn: "1326168353000010",
      mainBillCode: "2026062030",
      model: "H17KBKS5",
    });
    expect(result.found).toBe(false);
    expect(result.error).toContain("not found on this bill");
    expect(result.requiresEan).toBe(true);
  });

  it("has no duplicate GUID in the test data", () => {
    const guids = MOCK_BILL_LINES.map((line) => line.GUID);
    expect(guids.length).toBe(new Set(guids).size);
  });

  it("confirms the return and updates the processed quantity", async () => {
    const result = await confirmReturn(ctx, { context, sn: "1326168351000021" });
    expect(result.success).toBe(true);
    // the quantity of the model (6 planned, 2 returned)
    expect(result.actualQty).toBe(2);
    expect(result.planQty).toBe(6);

    // the bill shows the new processed quantity
    const groups = await getBillModels(ctx, { sapMainBillCode: "2026062030" });
    const group = groups.find((g) => g.model === "43A4200G");
    expect(group?.doneQty).toBe(2);
    expect(group?.diffQty).toBe(4);

    // the customer row of the first customer
    const row = group?.rows.find((r) => r.customerCode === "12000957");
    expect(row?.doneQty).toBe(2);
    expect(row?.diffQty).toBe(3);
  });

  it("submits the return with the EAN", async () => {
    const result = await submitReturnWithEAN(ctx, {
      context,
      sn: "1326168351000022",
      ean: "6130839049193",
      model: context.f_model,
    });
    expect(result.success).toBe(true);
    // 1 unit was already returned in the seed, this one makes it 2
    expect(result.actualQty).toBe(2);
    expect(result.planQty).toBe(6);

    const groups = await getBillModels(ctx, { sapMainBillCode: "2026062030" });
    const group = groups.find((g) => g.model === "43A4200G");
    expect(group?.doneQty).toBe(2);
    expect(group?.diffQty).toBe(4);
  });

  it("counts the quantity of a customer and of the whole model", async () => {
    // the whole model of the bill
    const model = getModelCounts("2026062030", "43A4200G");
    expect(model.planQty).toBe(6);
    expect(model.doneQty).toBe(1);
    expect(model.diffQty).toBe(5);

    // only the first customer of the model
    const customer = getModelCounts("2026062030", "43A4200G", "12000957");
    expect(customer.planQty).toBe(5);
    expect(customer.doneQty).toBe(1);
    expect(customer.diffQty).toBe(4);

    // the second customer of the same model
    const other = getModelCounts("2026062030", "43A4200G", "12000958");
    expect(other.planQty).toBe(1);
    expect(other.doneQty).toBe(0);
    expect(other.diffQty).toBe(1);
  });
});

/* ==========================================================================
   The real WMS API (api/DeliveryReturn)
   ========================================================================== */

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

describe("DeliveryReturnBill api (real WMS API)", () => {
  beforeEach(() => {
    setMockMode(false);
  });

  afterEach(() => {
    setMockMode(true);
    jest.restoreAllMocks();
  });

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

  it("builds the sign fields of BaseSignInfo", () => {
    const sign = getOperateSign(ctx);
    expect(sign.operateUserCode).toBe("user");
    expect(sign.operateUserName).toBe("name");
    expect(sign.operateWareHouseCode).toBe(ctx.gs_wareCode);
    expect(sign.operateRandomNumber).toBe("2");
    expect(sign.operateVersion).toBe(ctx.gs_version);
    expect(sign.operateSign).toBe(MD5("user" + "name" + "2" + ctx.gs_PasswordSalt));
  });

  it("scans a return bill, signs the request and maps the sample row", async () => {
    mockFetch({ code: 200, message: "success", data: [SAMPLE_ROW] });

    const groups = await getBillModels(ctx, { sapMainBillCode: "2026062030" });
    expect(groups.length).toBe(1);

    const group = groups[0];
    // one line, plan from BILL_COUNT, done from the "C" status
    expect(group.model).toBe("FC-33DT4SAW");
    expect(group.planQty).toBe(1);
    expect(group.doneQty).toBe(1);
    expect(group.diffQty).toBe(0);

    const row = group.rows[0];
    // the planId of the save is the GUID, the columns come from the sample
    expect(row.lineId).toBe("1326168354000060");
    expect(row.sapMainBillCode).toBe("2026062030");
    expect(row.systemDeliveryCode).toBe("1326168354");
    expect(row.customerCode).toBe("12000957");
    expect(row.toWarehouseCode).toBe("");

    // the request carried the path, the parameters and the operate* sign
    const url = decodeURIComponent((globalThis as any).fetch.mock.calls[0][0]);
    expect(url).toContain(`${ctx.gs_BaseURL}${API_PATH}/ScanReturnBill?`);
    expect(url).toContain("returnBillCode=2026062030");
    expect(url).toContain(`warehouseCode=${ctx.gs_wareCode}`);
    expect(url).toContain("operateUserCode=user");
    expect(url).toContain("operateUserName=name");
    expect(url).toContain("operateRandomNumber=2");
    expect(url).toContain(`operateSign=${MD5("user" + "name" + "2" + "salt")}`);
    expect(url).toContain(`operateVersion=${ctx.gs_version}`);
  });

  it("surfaces the message of the warehouse check of the server", async () => {
    mockFetch({ Code: 404, Message: "No model found for this bill in your warehouse" });

    await expect(
      getBillModels(ctx, { sapMainBillCode: "2026062030" })
    ).rejects.toThrow("No model found for this bill in your warehouse");
  });

  it("maps the traceability of a found SN", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: {
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
      mainBillCode: "2026062030",
      model: "43A4200G",
    });
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
  });

  it("asks for the EAN when the SN has no delivery", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: {
        sn: "KLE0535030012055",
        traceabilityExists: false,
        message: "No delivery found for this SN, please scan the EAN",
      },
    });

    const result = await checkSNTraceability(ctx, {
      sn: "KLE0535030012055",
      mainBillCode: "2026062030",
      model: "43A4200G",
    });
    expect(result.found).toBe(false);
    expect(result.traces.length).toBe(0);
    expect(result.requiresEan).toBe(true);
    expect(result.error).toBe("No delivery found for this SN, please scan the EAN");
  });

  it("surfaces the model mismatch of the server", async () => {
    mockFetch({
      Code: 400,
      Message: "SN model 43A4200G does not match the selected model 43A4200H",
    });

    await expect(
      checkSNTraceability(ctx, {
        sn: "KLE0535030012055",
        mainBillCode: "2026062030",
        model: "43A4200H",
      })
    ).rejects.toThrow("SN model 43A4200G does not match the selected model 43A4200H");
  });

  it("maps the models of the EAN lookup", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: [
        { model: "43A4200G", modelDesc: "FHD TV 43", colorName: "", ean: "6130839053541" },
        { model: "43A4200H", modelDesc: "FHD TV 43", colorName: "BLACK", ean: "6130839053541" },
      ],
    });

    const result = await lookupByEAN(ctx, {
      ean: "6130839053541",
      mainBillCode: "2026062030",
    });
    expect(result.candidates.length).toBe(2);
    expect(result.candidates[0].model).toBe("43A4200G");
    expect(result.candidates[1].colorName).toBe("BLACK");
    expect(result.candidates[1].ean).toBe("6130839053541");
  });

  it("saves the return of a traced SN (JSON body, TRACE)", async () => {
    mockFetch({
      code: 200,
      message: "success",
      data: { returnBillCode: "2026062030", sn: "KLE0535030012055", model: "43A4200G", qty: 6, qtyOk: 2, billFinished: false },
    });

    const result = await confirmReturn(ctx, {
      context: context,
      sn: "KLE0535030012055",
      trace: {
        ...context as any,
        sn: "KLE0535030012055",
        outBillCode: "1326168354",
        sapMainBillCode: "SAPBILL-1",
        sapUuid: "SAPUUID-1",
      },
    });

    expect(result.success).toBe(true);
    expect(result.planQty).toBe(6);
    expect(result.actualQty).toBe(2);
    expect(result.billFinished).toBe(false);

    // the POST carries the JSON body of SaveReturnDetailRequest
    const [url, options] = (globalThis as any).fetch.mock.calls[0];
    expect(url).toBe(`${ctx.gs_BaseURL}${API_PATH}/SaveReturnDetail`);
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");

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
      data: { returnBillCode: "2026062030", sn: "KLE0535030012055", model: "43A4200H", qty: 2, qtyOk: 2, billFinished: true },
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
  });
});
