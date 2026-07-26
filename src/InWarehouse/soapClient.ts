/**
 * SOAP Client for InWarehouse flow in src2
 * Provides real SOAP XML constructs & regex parsing for the MES asmx service list.
 */

// Simple regex xml extractor
import * as pubfunction from "../pubfunction";

const decodeHtmlEntities = (str: string): string => {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

const getField = (xml: string, tag: string): string => {
  const regex = new RegExp(`<[a-zA-Z0-9_:]*${tag}[^>]*>([\\s\\S]*?)</[a-zA-Z0-9_:]*${tag}>`);
  const m = regex.exec(xml);
  return m ? m[1].trim() : "";
};

const parseRows = (xml: string): any[] => {
  const decoded = decodeHtmlEntities(xml);
  // Matches any row tags like <dt>, <DT>, <Table>, <row> with or without namespace/attributes
  const rowRegex = /<(?:[a-zA-Z0-9_:]+)?(dt|DT|Table|row)[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_:]+)?\1>/gi;
  const rows: any[] = [];
  let match;
  while ((match = rowRegex.exec(decoded)) !== null) {
    const rowXml = match[2];
    if (!rowXml) continue;

    const extract = (tag: string) => {
      const m = new RegExp(`<[a-zA-Z0-9_:]*${tag}[^>]*>([\\s\\S]*?)</[a-zA-Z0-9_:]*${tag}>`).exec(rowXml);
      return m ? m[1].trim() : "";
    };

    rows.push({
      isok: extract("isok") || "1",
      retstr: extract("retstr"),
      palletCode: extract("palletCode"),
      scanType: extract("scanType"),
      totalQty: extract("totalQty"),
      scanBarcodeLarge: extract("scanBarcodeLarge"),
      model: extract("model"),
      color: extract("color"),
      boxQty: extract("boxQty"),
      fxh: extract("fxh"),
      boxCode: extract("boxCode") || extract("scanBarcodeLarge"),
      qty: extract("qty") || extract("boxQty") || "1",
      orderCode: extract("orderCode"),
      SN: extract("SN"),
      imeiCode1: extract("imeiCode1"),
      imeiCode2: extract("imeiCode2"),
      imeiCode3: extract("imeiCode3"),
      realdate: extract("realdate"),
    });
  }

  if (rows.length === 0) {
    console.log("parseRows: 0 rows parsed from decoded XML:", decoded);
  }

  return rows;
};

/**
 * Perform a real SOAP Web service request to target ASMX
 */
const doSoapRequest = async (url: string, action: string, xmlBody: string): Promise<string> => {
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

export const InBarcodeCheck = async (
  baseUrl: string,
  factoryCodeMES: string,
  scanCode: string
): Promise<any[]> => {
  const cleanCode = scanCode.toUpperCase().trim();
  try {
    const xml = `<InBarcodeCheck xmlns="http://tempuri.org/">
      <factoryCode>${factoryCodeMES}</factoryCode>
      <scanCode>${cleanCode}</scanCode>
    </InBarcodeCheck>`;

    const resXml = await doSoapRequest(baseUrl, "InBarcodeCheck", xml);
    console.log("resXml",resXml);
    const resultXml = getField(resXml, "InBarcodeCheckResult");
    console.log("resultXml",resultXml);
    return parseRows(resultXml);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return [{ isok: "0", retstr: "Network Error" }];
  }
};

export const InPalletInsert = async (
  baseUrl: string,
  factoryCodeMES: string,
  wareCode: string,
  scanType: string,
  palletCode: string,
  scanBarCode: string,
  classesCode: string,
  groupCode: string,
  workdate: string,
  userCode: string
): Promise<any[]> => {
  try {
    const xml = `<InPalletInsert xmlns="http://tempuri.org/">
      <factoryCode>${factoryCodeMES}</factoryCode>
      <wareHouseCode>${wareCode}</wareHouseCode>
      <scanType>${scanType}</scanType>
      <palletCode>${palletCode}</palletCode>
      <scanBarCode>${scanBarCode}</scanBarCode>
      <classesCode>${classesCode}</classesCode>
      <groupCode>${groupCode}</groupCode>
      <workdate>${workdate}</workdate>
      <createUser>${userCode}</createUser>
    </InPalletInsert>`;

    const resXml = await doSoapRequest(baseUrl, "InPalletInsert", xml);
    const resultXml = getField(resXml, "InPalletInsertResult");
    return parseRows(resultXml);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return [{ isok: "0", retstr: "Network Error" }];
  }
};

export const InPalletSNConfirmBox = async (
  baseUrl: string,
  factoryCodeMES: string,
  palletCode: string
): Promise<any[]> => {
  try {
    const xml = `<InPalletSNConfirmBox xmlns="http://tempuri.org/">
      <factoryCode>${factoryCodeMES}</factoryCode>
      <palletCode>${palletCode}</palletCode>
    </InPalletSNConfirmBox>`;

    const resXml = await doSoapRequest(baseUrl, "InPalletSNConfirmBox", xml);
    console.log("resXmlconfirm",resXml);
    const resultXml = getField(resXml, "InPalletSNConfirmBoxResult");
    return parseRows(resultXml);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message+"here" || String(err));
    return [{ isok: "0", retstr: "Network Error" }];
  }
};

export const InPalletSNConfirm = async (
  baseUrl: string,
  factoryCodeMES: string,
  palletCode: string,
  boxCode: string
): Promise<any[]> => {
  try {
    const xml = `<InPalletSNConfirm xmlns="http://tempuri.org/">
      <factoryCode>${factoryCodeMES}</factoryCode>
      <palletCode>${palletCode}</palletCode>
      <boxCode>${boxCode}</boxCode>
    </InPalletSNConfirm>`;

    const resXml = await doSoapRequest(baseUrl, "InPalletSNConfirm", xml);
    const resultXml = getField(resXml, "InPalletSNConfirmResult");
    return parseRows(resultXml);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return [{ isok: "0", retstr: "Network Error" }];
  }
};

export const InPalletSNBox = async (
  baseUrl: string,
  factoryCodeMES: string,
  wareCode: string,
  palletCode: string
): Promise<any[]> => {
  try {
    const xml = `<InPalletSNBox xmlns="http://tempuri.org/">
      <factoryCode>${factoryCodeMES}</factoryCode>
      <wareHouseCode>${wareCode}</wareHouseCode>
      <palletCode>${palletCode}</palletCode>
    </InPalletSNBox>`;

    const resXml = await doSoapRequest(baseUrl, "InPalletSNBox", xml);
    const resultXml = getField(resXml, "InPalletSNBoxResult");
    return parseRows(resultXml);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return [{ isok: "0", retstr: "Network Error" }];
  }
};

export const InPalletSN = async (
  baseUrl: string,
  factoryCodeMES: string,
  wareCode: string,
  palletCode: string,
  boxCode: string
): Promise<any[]> => {
  try {
    const xml = `<InPalletSN xmlns="http://tempuri.org/">
      <factoryCode>${factoryCodeMES}</factoryCode>
      <wareHouseCode>${wareCode}</wareHouseCode>
      <palletCode>${palletCode}</palletCode>
      <boxCode>${boxCode}</boxCode>
    </InPalletSN>`;

    const resXml = await doSoapRequest(baseUrl, "InPalletSN", xml);
    const resultXml = getField(resXml, "InPalletSNResult");
    return parseRows(resultXml);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return [{ isok: "0", retstr: "Network Error" }];
  }
};

export const HelloWorld = async (baseUrl: string): Promise<string> => {
  const xml = `<HelloWorld xmlns="http://tempuri.org/" />`;
  const resXml = await doSoapRequest(baseUrl, "HelloWorld", xml);
  return getField(resXml, "HelloWorldResult") || "ok";
};

