/**
 * SOAP Client for Delivery flow in src2
 * Provides real SOAP XML constructs & regex parsing for the MES asmx service list.
 */

// Simple regex xml extractor
import * as pubfunction from "../pubfunction";

const getField = (xml: string, tag: string): string => {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`);
  const m = regex.exec(xml);
  return m ? m[1].trim() : "";
};

const doSoapRequest = async (url: string, action: string, xmlBody: string): Promise<string> => {
  // Try to use URL directly, or build default asmx path
  const reqUrl = url.endsWith(".asmx") ? url : `${url}/WINCEWeb.asmx`;
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${xmlBody}
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(reqUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `http://tempuri.org/${action}`
    },
    body: envelope
  });

  if (!response.ok) {
    pubfunction.ShowError(`REST request failed: HTTP ${response.status}`);
  }
  return await response.text();
};

/**
 * Updates bill code for DA warehouse mapping on MES server.
 */
export const UpdateBillDA = async (
  baseUrl: string,
  sapMainBillCode: string
): Promise<boolean> => {
  const cleanCode = (sapMainBillCode || "").toUpperCase().trim();
  if (!cleanCode) return false;

  try {
    const xml = `<UpdateBillDA xmlns="http://tempuri.org/">
      <sapBillCode>${cleanCode}</sapBillCode>
    </UpdateBillDA>`;

    const text = await doSoapRequest(baseUrl, "UpdateBillDA", xml);
    const resultMatch = text.match(/<UpdateBillDAResult>(.*?)<\/UpdateBillDAResult>/);
    if (resultMatch && resultMatch[1]) {
      return resultMatch[1].toLowerCase() === "true";
    }
    return false;
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return false;
  }
};

export const PWMS_DELIVERY_RETURNDEAL = async (
  baseUrl: string,
  sapMainBillCode: string
): Promise<boolean> => {

  const cleanCode = (sapMainBillCode || "").toUpperCase().trim();
  if (!cleanCode) return false;

  try {
    const xml = `<PWMS_DELIVERY_RETURNDEAL xmlns="http://tempuri.org/">
      <sapBillCode>${cleanCode}</sapBillCode>
    </PWMS_DELIVERY_RETURNDEAL>`;

    const text = await doSoapRequest(baseUrl, "PWMS_DELIVERY_RETURNDEAL", xml);
    console.log(`[SOAP] PWMS_DELIVERY_RETURNDEAL response for ${cleanCode}:`, text);

    const resultMatch = text.match(/<PWMS_DELIVERY_RETURNDEALResult>(.*?)<\/PWMS_DELIVERY_RETURNDEALResult>/);
    if (resultMatch && resultMatch[1]) {
      console.log(`[SOAP] PWMS_DELIVERY_RETURNDEAL parsed result:`, resultMatch[1]);
      return resultMatch[1].toLowerCase() === "true";
    }
    return false;
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return false;
  }
};
