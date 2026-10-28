import React, { createContext, useContext, useState } from 'react';

/* ==========================================================
   Type definition for the second Global String Context
========================================================== */
export interface AppConfig {
  [key: string]: any;
}

export type GlobalStrContextType = {
  gs_factoryCode: string;
  setgs_factoryCode: (v: string) => void;

  gs_factoryCodeMES: string;
  setgs_factoryCodeMES: (v: string) => void;

  gs_wareCode: string;
  setgs_wareCode: (v: string) => void;
  gs_wareName: string;
  setgs_wareName: (v: string) => void;
  gs_wareType: string;
  setgs_wareType: (v: string) => void;

  gs_classCode: string;
  setgs_classCode: (v: string) => void;
  gs_className: string;
  setgs_className: (v: string) => void;

  gs_groupCode: string;
  setgs_groupCode: (v: string) => void;
  gs_groupName: string;
  setgs_groupName: (v: string) => void;

  gs_userCode: string;
  setgs_userCode: (v: string) => void;
  gs_userName: string;
  setgs_userName: (v: string) => void;
  gs_remark: string;
  setgs_remark: (v: string) => void;

  gs_workdate: string;
  setgs_workdate: (v: string) => void;

  gs_IPAddress: string;
  setgs_IPAddress: (v: string) => void;

  gs_Project_ExecutePath: string;
  setgs_Project_ExecutePath: (v: string) => void;

  appConfig: AppConfig | null;
  setAppConfig: (v: AppConfig | null) => void;

  gs_MESBaseURL: string;
  setgs_MESBaseURL: (v: string) => void;

  gs_BaseURL: string;
  setgs_BaseURL: (v: string) => void;

  gs_BaseURL_WEB: string;
  setgs_BaseURL_WEB: (v: string) => void;

  gs_deliveryReturnAPI: string;
  setgs_deliveryReturnAPI: (v: string) => void;

  gs_PADURL: string;
  setgs_PADURL: (v: string) => void;

  gs_PADURL_WEB: string;
  setgs_PADURL_WEB: (v: string) => void;

  gs_PasswordSalt: string;
  setgs_PasswordSalt: (v: string) => void;

  gs_randomNumber: string;
  setgs_randomNumber: (v: string) => void;

  gs_version: string;
  setgs_version: (v: string) => void;

  g_webUrl: string;
  setg_webUrl: (v: string) => void;

  g_isRealUrl: boolean;
  setg_isRealUrl: (v: boolean) => void;
};

/* ==========================================================
   Create Context
========================================================== */
const GlobalStrContext = createContext<GlobalStrContextType | null>(null);

/* ==========================================================
   Provider Component
========================================================== */
export const GlobalStrProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [gs_factoryCode, setFactoryCode] = useState('001');
  const [gs_factoryCodeMES, setFactoryCodeMES] = useState('001');

  const [gs_wareCode, setWareCode] = useState('');
  const [gs_wareName, setWareName] = useState('');
  const [gs_wareType, setWareType] = useState('');

  const [gs_classCode, setClassCode] = useState('');
  const [gs_className, setClassName] = useState('');

  const [gs_groupCode, setGroupCode] = useState('');
  const [gs_groupName, setGroupName] = useState('');

  const [gs_userCode, setUserCode] = useState('1');
  const [gs_userName, setUserName] = useState('1');
  const [gs_remark, setRemark] = useState('');

  const [gs_workdate, setWorkdate] = useState('');
  const [gs_IPAddress, setIPAddress] = useState('');

  const [gs_Project_ExecutePath, setProject_ExecutePath] = useState('');

  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  const [gs_MESBaseURL, setMESBaseURL] = useState('');

  const [gs_BaseURL, setBaseURL] = useState('https://wmsapi.condor.dz');
  const [gs_BaseURL_WEB, setBaseURL_WEB] = useState('https://wmsapi.condor.dz');

  const [gs_deliveryReturnAPI, setDeliveryReturnAPI] = useState(
    'https://mespdamobile.condor.dz/WMSPDANEW',
  );

  const [gs_PADURL, setPADURL] = useState('https://mesdownload.condor.dz');
  const [gs_PADURL_WEB, setPADURL_WEB] = useState(
    'https://mesdownload.condor.dz',
  );

  const [gs_PasswordSalt, setPasswordSalt] = useState('abc12345');
  const [gs_randomNumber, setRandomNumber] = useState('2');
  const [gs_version, setVersion] = useState('1.0.2');

  const [g_webUrl, setWebUrl] = useState(
    'https://mespdamobile.condor.dz/WINCEWeb.asmx',
  );
  const [g_isRealUrl, setIsRealUrl] = useState(true);

  return (
    <GlobalStrContext.Provider
      value={{
        gs_factoryCode,
        setgs_factoryCode: setFactoryCode,

        gs_factoryCodeMES,
        setgs_factoryCodeMES: setFactoryCodeMES,

        gs_wareCode,
        setgs_wareCode: setWareCode,
        gs_wareName,
        setgs_wareName: setWareName,
        gs_wareType,
        setgs_wareType: setWareType,

        gs_classCode,
        setgs_classCode: setClassCode,
        gs_className,
        setgs_className: setClassName,

        gs_groupCode,
        setgs_groupCode: setGroupCode,
        gs_groupName,
        setgs_groupName: setGroupName,

        gs_userCode,
        setgs_userCode: setUserCode,
        gs_userName,
        setgs_userName: setUserName,
        gs_remark,
        setgs_remark: setRemark,

        gs_workdate,
        setgs_workdate: setWorkdate,

        gs_IPAddress,
        setgs_IPAddress: setIPAddress,

        gs_Project_ExecutePath,
        setgs_Project_ExecutePath: setProject_ExecutePath,

        appConfig,
        setAppConfig,

        gs_MESBaseURL,
        setgs_MESBaseURL: setMESBaseURL,

        gs_BaseURL,
        setgs_BaseURL: setBaseURL,

        gs_BaseURL_WEB,
        setgs_BaseURL_WEB: setBaseURL_WEB,

        gs_deliveryReturnAPI,
        setgs_deliveryReturnAPI: setDeliveryReturnAPI,

        gs_PADURL,
        setgs_PADURL: setPADURL,

        gs_PADURL_WEB,
        setgs_PADURL_WEB: setPADURL_WEB,

        gs_PasswordSalt,
        setgs_PasswordSalt: setPasswordSalt,

        gs_randomNumber,
        setgs_randomNumber: setRandomNumber,

        gs_version,
        setgs_version: setVersion,

        g_webUrl,
        setg_webUrl: setWebUrl,

        g_isRealUrl,
        setg_isRealUrl: setIsRealUrl,
      }}
    >
      {children}
    </GlobalStrContext.Provider>
  );
};

/* ==========================================================
   Hook
========================================================== */
export const useGlobalStr = () => {
  const ctx = useContext(GlobalStrContext);
  if (!ctx) {
    throw new Error('useGlobalStr must be used inside GlobalStrProvider');
  }
  return ctx;
};
