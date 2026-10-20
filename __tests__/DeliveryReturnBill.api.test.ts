jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  checkSNTraceability,
  confirmReturn,
  getBillModels,
  getModelEAN,
  submitReturnWithEAN,
} from "../src/DeliveryReturnBill/api";
import { ApiContext } from "../src/DeliveryReturnBill/api";
import { ReturnContext } from "../src/DeliveryReturnBill/types";

const ctx: ApiContext = {
  gs_BaseURL: "http://localhost",
  gs_wareCode: "WH01",
  gs_userCode: "user",
  gs_userName: "name",
  gs_PasswordSalt: "salt",
  gs_version: "1.0.0",
  gs_classCode: "01",
  gs_IPAddress: "127.0.0.1",
};

const context: ReturnContext = {
  f_billCode: "SRT20260001",
  f_systemDeliveryCode: "DR202610001",
  f_sapMainBillCode: "SRT20260001",
  f_model: "MDL-A100",
  f_color: "BLACK",
  f_customerCode: "CUS001",
  f_operatorBatch: "OP-2026-0001",
  f_wareCode: "WH01",
  f_planQty: 10,
  f_doneQty: 4,
};

describe("DeliveryReturnBill api (dummy data)", () => {
  it("loads the models of the scanned bill", async () => {
    const rows = await getBillModels(ctx, { sapMainBillCode: "SRT20260001" });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].model).toBe("MDL-A100");
    expect(rows[0].diffQty).toBe(rows[0].planQty - rows[0].doneQty);
  });

  it("returns the EAN of the model", async () => {
    expect(await getModelEAN(ctx, "MDL-A100")).toBe("6131000000017");
  });

  it("finds the traceability of a known SN", async () => {
    const result = await checkSNTraceability(ctx, {
      sn: "SN0001",
      billCode: context.f_systemDeliveryCode,
      model: context.f_model,
    });
    expect(result.found).toBe(true);
    expect(result.trace?.imei1).toBe("860111111111111");
    expect(result.trace?.productStatus).toBe("DELIVERED");
  });

  it("returns an error for a SN without traceability", async () => {
    const result = await checkSNTraceability(ctx, {
      sn: "SN9999",
      billCode: context.f_systemDeliveryCode,
      model: context.f_model,
    });
    expect(result.found).toBe(false);
    expect(result.error).toContain("SN9999");
  });

  it("confirms the return and updates the processed quantity", async () => {
    const result = await confirmReturn(ctx, { context, sn: "SN0001" });
    expect(result.success).toBe(true);
    expect(result.actualQty).toBe(5);
    expect(result.planQty).toBe(10);
  });

  it("submits the return with the EAN", async () => {
    const result = await submitReturnWithEAN(ctx, {
      context,
      sn: "SN9999",
      ean: "6131000000017",
    });
    expect(result.success).toBe(true);
    expect(result.actualQty).toBe(5);
  });
});
