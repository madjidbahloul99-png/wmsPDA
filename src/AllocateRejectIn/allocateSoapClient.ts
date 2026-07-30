import * as pubfunction from "../pubfunction";

/**
 * SOAP Client for AllocateRejectIn flow in src2
 * Provides real SOAP XML constructs & regex parsing for the MES asmx service list.
 */

// Simple regex XML tag content extractor
const getField = (xml: string, tag: string): string => {
  const regex = new RegExp(`<[a-zA-Z0-9_:]*${tag}[^>]*>([\\s\\S]*?)</[a-zA-Z0-9_:]*${tag}>`);
  const m = regex.exec(xml);
  return m ? m[1].trim() : "";
};

const decodeHtmlEntities = (str: string): string => {
  if (!str) return "";
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

// Parser for dt XML rows returned inside dataset
export const parseRows = (xml: string): any[] => {
  if (!xml) return [];
  const decoded = decodeHtmlEntities(xml);
  const rows: any[] = [];

  // Matches specific row tags (dt, DT, Table, Table1, row, etc.) with or without attributes/namespaces
  const rowRegex = /<(?:[a-zA-Z0-9_:]+)?(dt|DT|Table|Table1|row)[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_:]+)?\1>/gi;
  let match;
  while ((match = rowRegex.exec(decoded)) !== null) {
    const rowXml = match[2];
    if (!rowXml) continue;

    const extract = (tag: string) => {
      const m = new RegExp(`<[a-zA-Z0-9_:]*${tag}[^>]*>([\\s\\S]*?)</[a-zA-Z0-9_:]*${tag}>`, "i").exec(rowXml);
      return m ? m[1].trim() : "";
    };

    const boxCode = extract("boxCode");
    const model = extract("model");
    const isok = extract("isok");
    const retstr = extract("retstr");
    const totalQty = extract("totalQty");
    const sn = extract("SN") || extract("sn");
    const fxh = extract("fxh");
    const allocCode = extract("allocateCode");

    if (boxCode || model || isok || retstr || totalQty || sn || fxh || allocCode) {
      rows.push({
        // AllocateInPalletSNConfirmInjectOldWMS columns
        id: extract("id") || extract("ID") || fxh || sn,
        fxh: fxh,
        SN: sn,
        model: model,
        color: extract("color"),
        boxCode: boxCode,
        palletCode: extract("palletCode"),
        realdate: extract("realdate"),
        orderCode: extract("orderCode"),
        allocateCode: allocCode,
        systemAllocateCode: extract("systemAllocateCode") || extract("sysAllocateCode"),

        // AllocateInRejectOldWMS columns
        isok: isok || "1",
        retstr: retstr || "",
        totalQty: totalQty || "0",
        isfinish: extract("isfinish") || "0",
        boxQty: extract("boxQty") || "0",
      });
    }
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

/**
 * Web Service Method: AllocateInPalletSNConfirmInjectOldWMS
 */
export const AllocateInPalletSNConfirmInjectOldWMS = async (
  baseUrl: string,
  factoryCode: string,
  allocateCode: string,
  wareCode: string,
  barcode: string
): Promise<any[]> => {
  const cleanBarcode = barcode.toUpperCase().trim();
  const xml = `<AllocateInPalletSNConfirmInjectOldWMS xmlns="http://tempuri.org/">
      <factoryCode>${factoryCode || "001"}</factoryCode>
      <allocateCode>${allocateCode || ""}</allocateCode>
      <wareHouseCode>${wareCode || ""}</wareHouseCode>
      <barCode>${cleanBarcode}</barCode>
    </AllocateInPalletSNConfirmInjectOldWMS>`;

    const resXml = await doSoapRequest(baseUrl, "AllocateInPalletSNConfirmInjectOldWMS", xml);
    const resultXml = getField(resXml, "AllocateInPalletSNConfirmInjectOldWMSResult");
    return parseRows(resultXml);
};

/**
 * Web Service Method: AllocateInInsertRejectOldWMS
 * Transmits DataTable serialized inside SOAP envelope
 */
export const AllocateInInsertRejectOldWMS = async (
  baseUrl: string,
  dt: any[],
  wareCode: string,
  userCode: string,
  userName: string
): Promise<string> => {
  const xml = `<AllocateInInsertRejectOldWMS xmlns="http://tempuri.org/">
      <dt>
        <xs:schema id="NewDataSet" xmlns="" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
          <xs:element name="NewDataSet" msdata:IsDataSet="true" msdata:MainDataTable="dt" msdata:UseCurrentLocale="true">
            <xs:complexType>
              <xs:choice minOccurs="0" maxOccurs="unbounded">
                <xs:element name="dt">
                  <xs:complexType>
                    <xs:sequence>
                      <xs:element name="id" type="xs:string" minOccurs="0" />
                      <xs:element name="fxh" type="xs:string" minOccurs="0" />
                      <xs:element name="SN" type="xs:string" minOccurs="0" />
                      <xs:element name="model" type="xs:string" minOccurs="0" />
                      <xs:element name="color" type="xs:string" minOccurs="0" />
                      <xs:element name="boxCode" type="xs:string" minOccurs="0" />
                      <xs:element name="palletCode" type="xs:string" minOccurs="0" />
                      <xs:element name="realdate" type="xs:string" minOccurs="0" />
                      <xs:element name="orderCode" type="xs:string" minOccurs="0" />
                      <xs:element name="allocateCode" type="xs:string" minOccurs="0" />
                      <xs:element name="systemAllocateCode" type="xs:string" minOccurs="0" />
                    </xs:sequence>
                  </xs:complexType>
                </xs:element>
              </xs:choice>
            </xs:complexType>
          </xs:element>
        </xs:schema>
        <diffgr:diffgram xmlns:msdata="urn:schemas-microsoft-com:xml-msdata" xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">
          <DocumentElement xmlns="">
            ${dt.map((row, index) => `
            <dt diffgr:id="dt${index + 1}" msdata:rowOrder="${index}">
              <id>${row.id || row.fxh || ""}</id>
              <fxh>${row.fxh || ""}</fxh>
              <SN>${row.SN || ""}</SN>
              <model>${row.model || ""}</model>
              <color>${row.color || ""}</color>
              <boxCode>${row.boxCode || ""}</boxCode>
              <palletCode>${row.palletCode || ""}</palletCode>
              <realdate>${row.realdate || ""}</realdate>
              <orderCode>${row.orderCode || ""}</orderCode>
              <allocateCode>${row.allocateCode || ""}</allocateCode>
              <systemAllocateCode>${row.systemAllocateCode || ""}</systemAllocateCode>
            </dt>`).join("")}
          </DocumentElement>
        </diffgr:diffgram>
      </dt>
      <wareHouseCode>${wareCode || ""}</wareHouseCode>
      <createUser>${userCode || ""}</createUser>
      <userName>${userName || ""}</userName>
    </AllocateInInsertRejectOldWMS>`;

    const resXml = await doSoapRequest(baseUrl, "AllocateInInsertRejectOldWMS", xml);
    const result = getField(resXml, "AllocateInInsertRejectOldWMSResult");
    return result;
};

/**
 * Web Service Method: AllocateInRejectOldWMS
 */
export const AllocateInRejectOldWMS = async (
  baseUrl: string,
  factoryCode: string,
  wareCode: string,
  allocateCode: string,
  userCode: string
): Promise<any[]> => {
  const xml = `<AllocateInRejectOldWMS xmlns="http://tempuri.org/">
      <factoryCode>${factoryCode || ""}</factoryCode>
      <wareHouseCode>${wareCode || ""}</wareHouseCode>
      <allocateCode>${allocateCode || ""}</allocateCode>
      <createUser>${userCode || ""}</createUser>
    </AllocateInRejectOldWMS>`;

    const resXml = await doSoapRequest(baseUrl, "AllocateInRejectOldWMS", xml);
    const resultXml = getField(resXml, "AllocateInRejectOldWMSResult");
    return parseRows(resultXml);
};
