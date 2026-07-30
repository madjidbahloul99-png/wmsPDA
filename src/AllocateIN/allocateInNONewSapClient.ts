/**
 * REST and SOAP Client for AllocateInNONewSap flow in src2
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as pubfunction from "../pubfunction";

const doRestPost = async (url: string, body: any): Promise<any> => {

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };


  const response = await fetch(url, {
    method: "POST",
    headers,
    body: pubfunction.classToUrlStr(body),
  });

  if (!response.ok) {
    pubfunction.ShowError(`REST request failed: HTTP ${response.status}`);
  }
  return await response.json();
};

const doRestGet = async (url: string): Promise<any> => {

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };


  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    pubfunction.ShowError(`REST request failed: HTTP ${response.status}`);
   
  }
  return await response.json();
};

const doSoapRequest = async (soapUrl: string, soapAction: string, xmlBody: string): Promise<boolean> => {
  try {
    const reqUrl = soapUrl.endsWith(".asmx") ? soapUrl : `${soapUrl}/WINCEWeb.asmx`;
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
        "SOAPAction": `http://tempuri.org/${soapAction}`
      },
      body: envelope
    });

    if (!response.ok) {
      return false;
    }
    
    const responseText = await response.text();
    const resultTag = `${soapAction}Result`;
    const regex = new RegExp(`<${resultTag}[^>]*>(.*?)</${resultTag}>`, 'i');
    const match = responseText.match(regex);
    if (match && match[1]) {
      return match[1].toLowerCase() === 'true';
    }
    return true;
  } catch (err) {
    console.log((err as any)?.message || String(err));
    return false; // Fail gracefully to allow operation to continue
  }
};

export const newOldAllocateOutListBySapBillUsing = async (soapUrl: string, sapMainBillCode: string): Promise<boolean> => {
  const cleanCode = (sapMainBillCode || "").toUpperCase().trim();
  if (!cleanCode) return false;
  const xmlBody = `<NewOldAllocateOutListBySapBillUsing xmlns="http://tempuri.org/">
    <sapBillCode>${cleanCode}</sapBillCode>
  </NewOldAllocateOutListBySapBillUsing>`;
  return await doSoapRequest(soapUrl, "NewOldAllocateOutListBySapBillUsing", xmlBody);
};

export const updateBillDA = async (soapUrl: string, sapMainBillCode: string): Promise<boolean> => {
  const cleanCode = (sapMainBillCode || "").toUpperCase().trim();
  if (!cleanCode) return false;
  const xmlBody = `<UpdateBillDA xmlns="http://tempuri.org/">
    <sapBillCode>${cleanCode}</sapBillCode>
  </UpdateBillDA>`;
  return await doSoapRequest(soapUrl, "UpdateBillDA", xmlBody);
};

export const newOldSaveAllocateOutBySapBillUsingAll = async (soapUrl: string, sapMainBillCode: string): Promise<boolean> => {
  const cleanCode = (sapMainBillCode || "").toUpperCase().trim();
  if (!cleanCode) return false;
  const xmlBody = `<NewOldSaveAllocateOutBySapBillUsingAll xmlns="http://tempuri.org/">
    <sapBillCode>${cleanCode}</sapBillCode>
  </NewOldSaveAllocateOutBySapBillUsingAll>`;
  return await doSoapRequest(soapUrl, "NewOldSaveAllocateOutBySapBillUsingAll", xmlBody);
};


export const getInWarehouseAllocateBillInfoByBillCodeFromSap = async (
  baseUrl: string,
  sapMainBillCode: string,
  warehouseCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  let urlCur = `${baseUrl}/warehouse/billInfo/getInWarehouseAllocateBillInfoByBillCodeFromSap`;
  
  //单据类型 调拨入库
  let billType = "5002";
  
  urlCur = pubfunction.AddUrlQuery(urlCur, "?", "sapMainBillCode", sapMainBillCode);
  urlCur = pubfunction.AddUrlQuery(urlCur, "&", "warehouseCode", warehouseCode);
  urlCur = pubfunction.AddUrlQuery(urlCur, "&", "billType", billType);
  
  //签名信息
  urlCur = urlCur + pubfunction.GetUserSign("&");
  
  try {
    const data = await doRestGet(urlCur);
    return data;
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message || "Network Error" };
  }
};

export const getWarehouseAllocateBillInfoByBillCodeFromSap = async (
  baseUrl: string,
  sapMainBillCode: string,
  warehouseCode: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  let urlCur = `${baseUrl}/warehouse/billInfo/getWarehouseAllocateBillInfoByBillCodeFromSap`;
  
  //单据类型 调拨出库
  let billType = "5001";

  urlCur = pubfunction.AddUrlQuery(urlCur, "?", "sapMainBillCode", sapMainBillCode);
  urlCur = pubfunction.AddUrlQuery(urlCur, "&", "warehouseCode", warehouseCode);
  urlCur = pubfunction.AddUrlQuery(urlCur, "&", "billType", billType);
  
  //签名信息
  urlCur = urlCur + pubfunction.GetUserSign("&");
  
  try {
    const data = await doRestGet(urlCur);
    return data;
  } catch (err: any) {
    console.log((err as any)?.message || String(err));
    return { success: false, msg: err.message || "Network Error" };
  }
};

export const getReceiptInfoByOperatorBatch = async (
  baseUrl: string,
  systemDeliveryCode: string,
  model: string,
  deliveryCode: string,
  guid: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  let urlCur = `${baseUrl}/warehouse/billInfo/getReceiptInfoByOperatorBatch`;
  
  //单据类型 调拨 AllocateIn
  let billType = "5002";

  let qo = {
    billCode: systemDeliveryCode,
    billType: billType,
    model: model,
    operatorBatchCode: deliveryCode,
    guid: guid
  };
  
  //通用签名类赋值
  qo = pubfunction.SetUserSignInfo(qo, userCode, userName, "2", passwordSalt, version, "en_US") as any;
  
  //url获取测试
  let urlTest = urlCur + "?" + pubfunction.classToUrlStr(qo);
  
  try {
    return await doRestPost(urlCur, qo);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message || "Network Error" };
  }
};

export const doAllocateWarehouseInStorage = async (
  baseUrl: string,
  systemDeliveryCode: string,
  warehouseCode: string,
  barCode: string,
  scanType: string,
  model: string,
  deliveryCode: string,
  classCode: string,
  ipAddress: string,
  sapMainBillCode: string,
  guid: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  let urlCur = `${baseUrl}/warehouse/billInfo/doAllocateWarehouseInStorage`;
  
  //单据类型 调拨 AllocateIn
  let billType = "5002";

  let qo = {
    billCode: systemDeliveryCode,
    billType: billType,
    warehouseCode: warehouseCode,
    storageCode: "",
    scanBarCode: pubfunction.PostSpecialStr(barCode),
    scanBarCodeType: scanType,
    scanCount: "",
    materialCode: model,
    operatorBatch: deliveryCode,
    classCode: classCode,
    remark: "",
    workStationType: "AllocateIn",
    deviceIp: ipAddress,
    sapMainBillCode: sapMainBillCode,
    guid: guid
  };
  
  //通用签名类赋值
  qo = pubfunction.SetUserSignInfo(qo, userCode, userName, "2", passwordSalt, version, "en_US") as any;
  
  //url获取测试
  let urlTest = urlCur + "?" + pubfunction.classToUrlStr(qo);
  
  try {
    return await doRestPost(urlCur, qo);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message || "Network Error" };
  }
};

export const getAllocateInScanBarCodeSumInfo = async (
  baseUrl: string,
  systemDeliveryCode: string,
  barCode: string,
  scanType: string,
  model: string,
  warehouseCode: string,
  guid: string,
  userCode: string,
  userName: string,
  passwordSalt: string,
  version: string
): Promise<any> => {
  let urlCur = `${baseUrl}/warehouse/billInfo/getAllocateInScanBarCodeSumInfo`;
  
  //单据类型 调拨入库
  let billType = "5002";

  let qo = {
    billCode: systemDeliveryCode,
    billType: billType,
    warehouseCode: warehouseCode,
    scanBarCode: pubfunction.PostSpecialStr(barCode),
    scanBarCodeType: scanType,
    model: model,
    guid: guid
  };
  
  //通用签名类赋值
  qo = pubfunction.SetUserSignInfo(qo, userCode, userName, "2", passwordSalt, version, "en_US") as any;
  
  //url获取测试
  let urlTest = urlCur + "?" + pubfunction.classToUrlStr(qo);
  
  try {
    return await doRestPost(urlCur, qo);
  } catch (err: any) {
    pubfunction.ShowError((err as any)?.message || String(err));
    return { success: false, msg: err.message || "Network Error" };
  }
};
