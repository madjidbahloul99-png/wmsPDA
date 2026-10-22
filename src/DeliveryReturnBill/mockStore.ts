/**
 * In memory store of the dummy return bills.
 *
 * It behaves like the backend would: a returned unit is flagged as completed
 * (GOODS_MOVEMENT_STATUS = "C"), so the next load of the bill shows the new
 * processed quantity.
 */

import { MOCK_BILL_LINES } from "./mockData";
import { RawReturnBillLine } from "./types";

/** Runtime state, a copy of the seed of mockData.ts */
let state: RawReturnBillLine[] = MOCK_BILL_LINES.map((line) => ({ ...line }));

/** All the lines of the store. */
export const getAllLines = (): RawReturnBillLine[] => state;

/** The lines of one return bill. */
export const getLinesByBill = (mainBillCode: string): RawReturnBillLine[] => {
  const code = (mainBillCode || "").trim().toUpperCase();
  return state.filter((line) => (line.MAIN_BILL_CODE || "").toUpperCase() === code);
};

/**
 * Finds the units of a scanned code.
 *
 * The dummy uses the GUID of the unit as its SN, the trailing digits are
 * accepted as well so the unit can be scanned without typing the whole GUID.
 */
export const findUnits = (code: string): RawReturnBillLine[] => {
  const clean = (code || "").trim().toUpperCase();
  if (!clean) return [];

  const exact = state.filter((line) => (line.GUID || "").toUpperCase() === clean);
  if (exact.length > 0) return exact;

  return state.filter((line) => (line.GUID || "").toUpperCase().endsWith(clean));
};

/** Finds the unit of a scanned code. */
export const findUnit = (code: string): RawReturnBillLine | undefined =>
  findUnits(code)[0];

/**
 * Flags a unit as returned (completed movement).
 * Returns the updated line.
 */
export const markReturned = (code: string): RawReturnBillLine | undefined => {
  const unit = findUnit(code);
  if (!unit) return undefined;

  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  unit.GOODS_MOVEMENT_STATUS = "C";
  unit.GOODS_MOVEMENT_DATE = date;
  unit.DELIVERY_OR_ALLOCATEOUT = "RETURN";
  return unit;
};

/** Restores the seed, used by the tests. */
export const resetStore = (): void => {
  state = MOCK_BILL_LINES.map((line) => ({ ...line }));
};
