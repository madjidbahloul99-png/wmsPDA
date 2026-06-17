import React, {
    useState,
    useRef,
    forwardRef,
    useImperativeHandle,
    useEffect,
} from "react";
import md5 from "md5";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Modal,
    FlatList,
    BackHandler,
    Alert,
    TextInput,
    Dimensions,
    ActivityIndicator,
    Image,
    Linking
} from "react-native";
import { useGlobal } from "../GlobalContext";


// Import assets
import eyeIcon from "../assets/logo/eye.png";
import eyeCrossedIcon from "../assets/logo/eye-crossed.png";
import calendarIcon from "../assets/logo/calendar-day.png";
import userIcon from "../assets/logo/user.png";
import lockIcon from "../assets/logo/lock.png";
import warehouseIcon from "../assets/logo/warehouse.png";
import settingsIcon from "../assets/logo/settings.png";
import condorLogo from "../assets/logo/condor_logo.png";
import { User } from "lucide-react-native";


/* =====================
   Types
===================== */
type WarehouseItem = {
    wareHouseCode: string;
    wareHouseName: string;
};

type ClassItem = {
    ClassCode: string;
    ClassName: string;
};

type CustomInputRef = {
    focus: () => void;
};

/* =====================
   Custom Input
===================== */
const CustomInput = forwardRef<CustomInputRef, any>(
    (
        {
            label,
            value,
            placeholder,
            isSelect = false,
            isPassword = false,
            onChangeText,
            options = [],
            inputRef,
            onSubmitEditing,
            showSoftInput = false,
            onBlur,
            icon,
        },
        ref
    ) => {
        const [showModal, setShowModal] = useState(false);
        const [isFocused, setIsFocused] = useState(false);
        const [showPassword, setShowPassword] = useState(false);
        const [showKeyboard, setShowKeyboard] = useState(false);
        const hiddenInputRef = useRef<TextInput>(null);

        useImperativeHandle(ref, () => ({
            focus: () => hiddenInputRef.current?.focus(),
        }));

        const handleSelect = (item: any) => {
            onChangeText(item);
            setShowModal(false);
        };

        return (
            <View style={styles.inputWrapper}>
                {isSelect ? (
                    <TouchableOpacity
                        style={[styles.inputContainer, isFocused ? styles.inputFocused : null]}
                        onPress={() => setShowModal(true)}
                    >
                        {icon && <Image source={icon} style={styles.inputIcon} />}
                        <Text style={value ? styles.input : styles.placeholderText}>
                            {value || placeholder}
                        </Text>
                        <Text style={styles.chevronIcon}>▼</Text>
                    </TouchableOpacity>
                ) : (
                    <View
                        style={[styles.inputContainer, isFocused ? styles.inputFocused : null]}
                    >
                        {icon && <Image source={icon} style={styles.inputIcon} />}
                        <TextInput
                            ref={inputRef}
                            value={value}
                            onChangeText={onChangeText}
                            placeholder={placeholder}
                            placeholderTextColor="#94a3b8"
                            style={styles.input}
                            secureTextEntry={isPassword && !showPassword}
                            onFocus={() => setIsFocused(true)}
                            onBlur={(e) => {
                                setIsFocused(false);
                                if (onBlur) onBlur();
                            }}
                            onSubmitEditing={onSubmitEditing}
                            blurOnSubmit={false}
                            returnKeyType="next"
                            showSoftInputOnFocus={showSoftInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                            spellCheck={false}
                        />

                        {isPassword && (
                            <TouchableOpacity onPress={() => setShowPassword(showPassword)}>
                                <Image
                                    source={eyeCrossedIcon}
                                    style={styles.eyeIcon}
                                />
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {isSelect && (
                    <Modal transparent visible={showModal} animationType="fade">
                        <TouchableOpacity
                            style={styles.modalOverlay}
                            onPress={() => setShowModal(false)}
                        >
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Select {label}</Text>
                                <FlatList
                                    data={options}
                                    keyExtractor={(item: any) =>
                                        item.ClassCode ?? item.wareHouseCode ?? item
                                    }
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.optionItem}
                                            onPress={() => handleSelect(item)}
                                        >
                                            <Text style={styles.optionText}>
                                                {item.ClassName ?? item.wareHouseName ?? item}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        </TouchableOpacity>
                    </Modal>
                )}

                {isSelect && (
                    <TextInput
                        style={{ height: 0, width: 0, padding: 0, margin: 0 }}
                        ref={hiddenInputRef}
                        showSoftInputOnFocus={showSoftInput}
                    />
                )}
            </View>
        );
    }
);

/* =====================
   Login Screen
===================== */
export default function Login({ navigation }: any) {
    const {
        gsURL, setgs_gsURL,
        setOperateUserCode,
        setOperateUserName,
        setOperateWareHouseCode,
        setOperateRandomNumber, setOperateSign,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion
    } = useGlobal();


    const [userCode, setUserCode] = useState("");
    const [password, setPassword] = useState("");
    const [serverPassword, setServerPassword] = useState("");
    const [originalQRUser, setOriginalQRUser] = useState("");
    const [originalQRPassword, setOriginalQRPassword] = useState("");
    const [displayUserCode, setDisplayUserCode] = useState("");
    const scanTimer = useRef<any>(null);

    const [classOptions, setClassOptions] = useState<ClassItem[]>(
        []
    );


    const scanBuffer = useRef("");
    const lastKeyTime = useRef(0);

    /* =====================
       Password Compare Helper
    ===================== */

    const passwordsMatch = (input: string, server: string): boolean => {
        const normalize = (str: string) =>
            str.replace(/\\/g, "")  
                .replace(/[\r\n]/g, "") 
                .trim();

        return normalize(input) === normalize(server);
    };

    const checkUpdate = async (url?: string) => {
        const finalURL = url || gsURL;

        try {
            const res = await fetch(`${finalURL}/api/update/latest`);
            const json = await res.json();

            console.log("UPDATE API:", json);

            if (json.Code === 500) {
                Alert.alert("Error", json.Message);
                return;
            }

            const serverVersion = json.data.version;
            const apkUrl = json.data.url;
            const required = json.data.required;

            const currentVersion = operateVersion;

            if (currentVersion !== serverVersion) {
                if (required) {
                    Alert.alert(
                        "Mise à jour obligatoire",
                        `Version ${serverVersion} disponible`,
                        [
                            {
                                text: "Installer",
                                onPress: () => Linking.openURL(apkUrl)
                            }
                        ],
                        { cancelable: false }
                    );
                } else {
                    Alert.alert(
                        "Mise à jour disponible",
                        `Version ${serverVersion} disponible`,
                        [
                            { text: "Plus tard", style: "cancel" },
                            {
                                text: "Installer",
                                onPress: () => Linking.openURL(apkUrl)
                            }
                        ]
                    );
                }
            }

        } catch (err) {
            console.log("Update error:", err);
        }
    };

    useEffect(() => {
        checkUpdate(gsURL);
    }, []);


    useEffect(() => {
        console.log("OPERATE INFO UPDATED:", {
            userCode: operateUserCode,
            userName: operateUserName,
            warehouseCode: operateWareHouseCode,
            operateRandomNumber, operateSign
        });
    }, [operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign]);

    const handleUserCodeChange = (text: string) => {
        const now = Date.now();
        lastKeyTime.current = now;

        clearTimeout(scanTimer.current);



        if (text.endsWith("\n") || text.endsWith("\r")) {
            const cleanCode = text.trim();
            if (cleanCode.length > 0) {
                setUserCode(cleanCode);
                checkUserCode(cleanCode);
            }

            return;
        }

        setUserCode(text);


        if (text.includes("|")) {

            setDisplayUserCode(" ".repeat(text.length));
            scanTimer.current = setTimeout(() => {
                const finalCode = text.trim();
                //console.log("Reinforced Scan Buffer Stabilized:", finalCode);

              
                const parts = finalCode.split("|");
                if (parts.length >= 2) {
                    setDisplayUserCode(parts[0].trim()); 
                }
                checkUserCode(finalCode);
            }, 800);
        } else {

            scanTimer.current = setTimeout(() => {
                const finalCode = text.trim();

                Alert.alert("Error", "QR invalide ");
                setUserCode("")
                return;
            }, 400);


        }
    };

    const [selectedClass, setSelectedClass] =
        useState<ClassItem | null>(null);

    const [warehouseOptions, setWarehouseOptions] = useState<WarehouseItem[]>(
        []
    );
    const [selectedWarehouse, setSelectedWarehouse] =
        useState<WarehouseItem | null>(null);
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [tempURL, setTempURL] = useState(gsURL);

    const userRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);
    const warehouseRef = useRef<CustomInputRef>(null);
    const classRef = useRef<CustomInputRef>(null);


    const [activeField, setActiveField] = useState<"user" | "password" | "warehouse" | "class">("class");

    const ensureFocus = () => {
        setTimeout(() => {
            if (activeField === "user") userRef.current?.focus();
            else if (activeField === "password") passwordRef.current?.focus();
            else if (activeField === "warehouse") warehouseRef.current?.focus();
            else if (activeField === "class") classRef.current?.focus();
        }, 100);
    };

    const { gs_factoryCode } = useGlobal();
    const { setgs_wareCode } = useGlobal();
    const { setgs_wareName } = useGlobal();
    const { setgs_wareType } = useGlobal();
    const { setgs_classCode } = useGlobal();
    const { setgs_className } = useGlobal();
    const { gs_workdate, setgs_workdate } = useGlobal();
    const { setgs_userCode } = useGlobal();
    const { setgs_userName } = useGlobal();
    const { setgs_roleCode, gs_roleCode } = useGlobal();




    const handleSelectWarehouse = (item: any) => {
        setSelectedWarehouse(item);
        setOperateWareHouseCode(item.wareHouseCode);

        setTimeout(() => {
            warehouseRef.current?.focus();
        }, 100);
    };



    /* =====================
       Load Classes
    ===================== */

    const loadClasses = async (url?: string) => {
        const finalURL = url || gsURL;

        try {
            const res = await fetch(`${finalURL}/api/GetClassList/GetClassList`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ factoryCode: gs_factoryCode }),
            });

            const data = await res.json();

            if (data.Code === 500) {
                Alert.alert("Error", data.Message);
                return;
            }

            setClassOptions(
                data.data.map((c: any) => ({
                    ClassCode: c.classesCode,
                    ClassName: c.classesName,
                }))
            );

        } catch (err) {
            console.log(err);
            //  Alert.alert("Error", "Unable to load classes");
        }
    };


    useEffect(() => {

        loadClasses(gsURL);
        setTimeout(() => {
            classRef.current?.focus();
            setActiveField("class");
        }, 500);
    }, []);


    /* =====================
       Check User
    ===================== */
    const checkUserCode = async (manualInput?: string) => {
        const inputToProcess = typeof manualInput === "string" ? manualInput : userCode;
        if (!inputToProcess) {
            Alert.alert("Error", "UserCode required");
            return;
        }

       // console.log("Raw Input to checkUserCode:", `[${inputToProcess}]`);


        const normalizeQR = (str: string) => {
            return str
                .replace(/[\r\n]/g, "")
                .trim();
        };

        const cleanForCompare = (str: string) => {
            if (!str) return "";
            return str.replace(/\\/g, "").trim();
        };


        // QR Scan Detection (Format: username|password)  
        if (inputToProcess.includes("|")) {
            const cleanInput = normalizeQR(inputToProcess);

           // console.log("SCAN RAW:", `[${inputToProcess}]`);
            //console.log("SCAN CLEAN:", `[${cleanInput}]`);

            const parts = cleanInput.split("|");
            if (parts.length >= 2) {
                const u = parts[0].trim();

                const p = parts.slice(1).join("|").trim();

                setUserCode(u);
                setPassword(p);

                //console.log("Parsed QR -> User:", `[${u}]`, "Pass:", `[${p}]`);
                processQRScan(u, p);
                return;
            }
        }

        try {
            const res = await fetch(`${gsURL}/api/UserInfo/getuserinfo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    factoryCode: gs_factoryCode,
                    userCode: inputToProcess
                }),
            });

            const data = await res.json();

            if (data.Code === 500) {
                Alert.alert("Error", data.Message);
                return;
            }
            console.log("User Lookup Response:", data);

            if (data.code !== 200) {
                Alert.alert("Error", data.message);
                setUserCode("");
                setPassword("");
                return;
            }

            const rawData = data.data;
            const dataObj = Array.isArray(rawData) ? rawData[0] : rawData;

            if (!dataObj) {
                Alert.alert("Error", "User info not found");
                setUserCode("");
                setPassword("");
                return;
            }

            const passwordFromServer = dataObj.passwordInput?.trim();
            console.log("Server PW:", `[${passwordFromServer}]`);

            setServerPassword(passwordFromServer);
            setOperateUserCode(inputToProcess);
            setOperateUserName(dataObj.userName);
            setgs_roleCode(dataObj.frolecode);

            setActiveField("password");
            setTimeout(() => passwordRef.current?.focus(), 100);

        } catch (error) {
            console.log(error);
            Alert.alert("Error", "Server not reachable");
            setUserCode("");
        }
    };

    /* =====================
       Process QR Scan
    ===================== */
    const processQRScan = async (u: string, p: string) => {
        setLoading(true);
        setOriginalQRUser(u);
        setOriginalQRPassword(p);
        try {
            // 1. Get User Info
            const userRes = await fetch(`${gsURL}/api/UserInfo/getuserinfo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    factoryCode: gs_factoryCode,
                    userCode: u
                }),
            });
            const userData = await userRes.json();

            if (userData.Code === 500) {
                Alert.alert("Error", userData.Message);
                return;
            }

            const rawData = userData.data;
            const dataObj = Array.isArray(rawData) ? rawData[0] : rawData;

            if (userData.code !== 200 || !dataObj) {
                Alert.alert("Error", "User details missing in system");
                setLoading(false);
                setUserCode("");
                setPassword("");
                return;
            }

            const srvPwdRaw = dataObj.passwordInput;
            const srvPwd = srvPwdRaw?.trim() || "";

            //console.log("QR Validation - Comparing Input:", `[${p.trim()}]`, "with Server:", `[${srvPwd}]`);

            setServerPassword(srvPwd);
            setOperateUserCode(u);
            setOperateUserName(dataObj.userName);
            setgs_roleCode(dataObj.frolecode);

            // 2. Validate Password (Tolerant to backslashes and scanner reordering)
            if (!passwordsMatch(p, srvPwd)) {
                Alert.alert("Error", "QR Password Mismatch");
                setLoading(false);
                setUserCode("");
                setDisplayUserCode("");
                setPassword("");
                return;
            }

            // 3. Load Warehouses
            const wareRes = await fetch(
                `${gsURL}/api/WareListByFactory/GetWareListByFactory`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        factoryCode: gs_factoryCode,
                        userCode: u
                    }),
                }
            );

            const wareData = await wareRes.json();
            if (wareData.Code === 500) {
                Alert.alert("Error", wareData.Message);
                return;
            }
            setWarehouseOptions(
                wareData.data.map((w: any) => ({
                    wareHouseCode: w.wareHouseCode,
                    wareHouseName: w.wareHouseName.trim(),
                }))
            );

            setActiveField("warehouse");
            setTimeout(() => warehouseRef.current?.focus(), 100);
            Alert.alert("Success", "QR Login: Please select warehouse");

        } catch (error) {
            Alert.alert("Error", "QR processing failed");
            setUserCode("");
        } finally {
            setLoading(false);
        }
    };


    /* =====================
       Check Password
    ===================== */
    const checkPassword = async () => {
        if (!passwordsMatch(password, serverPassword)) {
            Alert.alert("Error", "Password Error, please check!");
            return;
        }

        try {
            const res = await fetch(
                `${gsURL}/api/WareListByFactory/GetWareListByFactory`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        factoryCode: gs_factoryCode,
                        userCode: userCode
                    }),
                }
            );

            const data = await res.json();
            console.log("donnes de wh", data);
            setWarehouseOptions(
                data.data.map((w: any) => ({
                    wareHouseCode: w.wareHouseCode,
                    wareHouseName: w.wareHouseName.trim(),
                }))
            );

            setActiveField("warehouse");
            setTimeout(() => warehouseRef.current?.focus(), 100);

        } catch {
            Alert.alert("Error", "Unable to load warehouses");
        }
    };

    const generateSignature = async () => {
        const random = Math.floor(Math.random() * 1000000).toString();

        const sign = md5(
            userCode +
            random +
            operateVersion +
            "SECRET_KEY"
        );

        return { random, sign };
    };

    /* =====================
       Final Login
    ===================== */
    const handleLogin = async () => {
        if (!selectedWarehouse) {
            Alert.alert("Error", "Select warehouse");
            return;
        }

        const wareHouseCode = selectedWarehouse.wareHouseCode;
        const wareHouseName = selectedWarehouse.wareHouseName;

        setgs_wareCode(wareHouseCode);
        setgs_wareName(wareHouseName);

        console.log("WAREHOUSE:", wareHouseCode, wareHouseName);




        try {
            /* =========================
               1️⃣ GET WAREHOUSE INFO
            ========================= */
            const resWare = await fetch(
                `${gsURL}/api/BaseWarehouse/GetWareInfo`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        factoryCode: gs_factoryCode,
                        wareHouseCode: wareHouseCode,
                    }),
                }
            );

            const dataWare = await resWare.json();
            if (dataWare.Code === 500) {
                Alert.alert("Error", dataWare.Message);
                return;
            }


            if (!resWare.ok || !dataWare.data) {
                Alert.alert("Error", "Warehouse does not exist!");
                return;
            }

            console.log("Données warehouse:", dataWare);

            const wareHouseType = dataWare.data.wareHouseType;
            setgs_wareType(wareHouseType);
            console.log("WAREHOUSE TYPE:", wareHouseType);

            /* =========================
            2️⃣ CHECK LICENSE
         ========================= */
            const resCheck = await fetch(
                `${gsURL}/api/CheckLicense/CheckLicense`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        factoryCode: gs_factoryCode,
                        wareHouseCode: wareHouseCode,
                    }),
                }
            );

            const dataCheck = await resCheck.json();

            if (dataCheck.Code === 500) {
                Alert.alert("Error", dataCheck.Message);
                return;
            }

            // Vérification
            if (!dataCheck.data) {
                Alert.alert("License Error", dataCheck.message || "Unknown error");
                return;
            }


            /* =========================
           3️⃣ CHECK USER
         ========================= */
            const resUser = await fetch(
                `${gsURL}/api/UserInfo/getuserinfo`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        factoryCode: gs_factoryCode,
                        userCode: userCode,
                    }),
                }
            );

            const dataUser = await resUser.json();

            if (dataUser.Code === 500) {
                Alert.alert("Error", dataUser.Message);
                return;
            }


            if (!resUser.ok || !dataUser.data) {
                Alert.alert(
                    "Error",
                    "The user does not have permissions to operate!"
                );
                return;
            }


            const srvPwdManual = dataUser.data.passwordInput?.trim() || "";

            if (!passwordsMatch(password, srvPwdManual)) {
                Alert.alert("Error", "Password Error, please check!");
                passwordRef.current?.focus();
                return;
            }


            setgs_userCode(userCode);
            setgs_userName(dataUser.data.userName);
            setgs_roleCode(dataUser.data.frolecode);


            setOperateUserCode(userCode);
            setOperateUserName(dataUser.data.userName);
            setOperateWareHouseCode(wareHouseCode);

            //console.log("User info are:", dataUser.data);


            /* =========================
              4️⃣ GET WORKDATE
           ========================= */

            try {
                if (!selectedClass) {
                    Alert.alert("Error", "Select Class");
                    return;
                }

                const ClassCode = selectedClass.ClassCode;
                const ClassName = selectedClass.ClassName;

                // Check if selected class time is valid
                try {
                    const resCheckTime = await fetch(`${gsURL}/api/CheckClassesTime`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            factoryCode: gs_factoryCode,
                            classesCode: ClassCode,
                        }),
                    });

                    if (resCheckTime.ok) {
                        const dataCheckTime = await resCheckTime.json();
                        if (dataCheckTime && dataCheckTime.data) {
                            if (dataCheckTime.data.result === 0) {
                                Alert.alert("Error", dataCheckTime.data.message || "Heure actuelle hors intervalle du shift");
                                return;
                            }
                        }
                    }
                } catch (checkErr) {
                    console.error("Error verifying classes time:", checkErr);
                }

                setgs_classCode(ClassCode);
                setgs_className(ClassName);

                const resWorkdate = await fetch(`${gsURL}/api/Workdate/getworkdate`, {
                    method: "POST", // POST obligatoire
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        factoryCode: gs_factoryCode,
                        classesCode: ClassCode,
                    }),
                });

                const dataWorkdate = await resWorkdate.json();

                if (dataWorkdate.Code === 500) {
                    Alert.alert("Error", dataWorkdate.Message);
                    return;
                }
                console.log("Workdate API response:", dataWorkdate);

                if (!resWorkdate.ok || !dataWorkdate.data) {
                    Alert.alert("Error", dataWorkdate.message || "Unable to get workdate!");
                    return;
                }


                setgs_workdate(dataWorkdate.data.workdate);
                console.log("Workdate set:", gs_workdate);

            } catch (error) {
                console.error("Fetch workdate error:", error);
                Alert.alert("Error", "Something went wrong while fetching workdate!");
            }





            /* =========================
               ✅ SUCCESS LOGIN
            ========================= */

            /* =========================
         ✅ GENERATE JWT AFTER ALL CHECKS
      ========================= */
            try {
                const tokenRes = await fetch(`${gsURL}/api/auth/login`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        UserCode: originalQRUser || userCode,
                        Password: originalQRPassword || password
                    }),
                });

                const tokenData = await tokenRes.json();

                console.log("JWT RESPONSE:", tokenData);

                // ✅ CHECK CORRECT
                if (tokenData.code !== 200) {
                    Alert.alert("Error", tokenData.message || "Cannot generate JWT");
                    return;
                }

                const token = tokenData.data?.token;

                if (!token) {
                    Alert.alert("Error", "Token missing");
                    return;
                }

                await AsyncStorage.setItem("userToken", token);


                const { random, sign } = await generateSignature();
                setOperateRandomNumber(random);
                setOperateSign(sign);


                navigation.navigate("Menu");
                

            } catch (error) {
                console.error("JWT generation error:", error);
                Alert.alert("Error", "Something went wrong while generating JWT!");
            }



        } catch (err) {
            console.error(err);
            Alert.alert("Error", "Cannot reach server or something went wrong!");
        }
    };


    return (
        <SafeAreaView style={styles.screen}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.container}>
                    {/* 1. Logo Condor Logistics */}
                    <View style={styles.logoContainer}>
                        <Image
                            source={condorLogo}
                            style={styles.condorLogo}
                            resizeMode="stretch"
                        />
                        <Text style={styles.wmsText}>WAREHOUSE MANAGEMENT SYSTEM</Text>
                    </View>


                    {loading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color="#0052cc" />
                            <Text style={styles.loadingText}>Processing QR Scan...</Text>
                        </View>
                    )}

                    <View style={styles.form}>
                        <CustomInput
                            ref={classRef}
                            label="Classes"
                            placeholder="Select Class"
                            value={selectedClass?.ClassName}
                            onChangeText={async (val: any) => {
                                if (!val) return;
                                try {
                                    const resCheckTime = await fetch(`${gsURL}/api/CheckClassesTime`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            factoryCode: gs_factoryCode,
                                            classesCode: val.ClassCode,
                                        }),
                                    });

                                    if (resCheckTime.ok) {
                                        const dataCheckTime = await resCheckTime.json();
                                        if (dataCheckTime && dataCheckTime.data) {
                                            if (dataCheckTime.data.result === 0) {
                                                Alert.alert("Error", dataCheckTime.data.message || "Heure actuelle hors intervalle du shift");
                                                setSelectedClass(null);
                                                return;
                                            }
                                        }
                                    }
                                } catch (checkErr) {
                                    console.error("Error verifying classes time on select:", checkErr);
                                }

                                setSelectedClass(val);
                                setActiveField("user");
                                setTimeout(() => userRef.current?.focus(), 100);
                            }}
                            isSelect
                            options={classOptions}
                            onBlur={ensureFocus}
                            icon={calendarIcon}
                        />

                        <CustomInput
                            label="User Code"
                            placeholder="Enter your ID"
                            value={displayUserCode}  
                            onChangeText={handleUserCodeChange}
                            inputRef={userRef}
                            //onSubmitEditing={() => checkUserCode()}
                            onFocus={() => setActiveField("user")}
                            onBlur={ensureFocus}
                            icon={userIcon}
                        />

                        <CustomInput
                            label="Password"
                            placeholder="••••••••"
                            value={password}
                            onChangeText={setPassword}
                            isPassword
                            inputRef={passwordRef}
                            onSubmitEditing={checkPassword}
                            onFocus={() => setActiveField("password")}
                            onBlur={ensureFocus}
                            icon={lockIcon}
                        />

                        <CustomInput
                            ref={warehouseRef}
                            label="Warehouse"
                            placeholder="Select Warehouse"
                            value={selectedWarehouse?.wareHouseName}
                            onChangeText={(val: any) => {
                                setSelectedWarehouse(val);
                                setOperateWareHouseCode(val.wareHouseCode);
                            }}
                            isSelect
                            options={warehouseOptions}
                            onSubmitEditing={handleSelectWarehouse}
                            onBlur={ensureFocus}
                            icon={warehouseIcon}
                        />
                    </View>

                    {/* 3. Version and Settings below Warehouse */}
                    <View style={styles.infoBox}>
                        <View style={styles.infoRow}>
                            <Text style={styles.version}>App Version  {operateVersion}</Text>
                            {gs_roleCode === "RoleAdmin" && (
                                <TouchableOpacity onPress={() => setShowSettings(true)}>
                                    <Image
                                        source={settingsIcon}
                                        style={styles.settingsIcon}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View style={styles.buttonContainer}>
                        <LinearGradient
                            colors={['#85ddf3ff', '#0052cc']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.gradientButton}
                        >
                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleLogin}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.primaryButtonText}>logIn</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>
                </View>

                {/* Settings Modal */}
                <Modal transparent visible={showSettings} animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>API Settings</Text>
                            <TextInput
                                style={styles.settingsInput}
                                value={tempURL}
                                onChangeText={setTempURL}
                                placeholder="Server URL"
                            />
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.cancelBtn]}
                                    onPress={() => setShowSettings(false)}
                                >
                                    <Text>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.saveBtn]}
                                    onPress={() => {
                                        setgs_gsURL(tempURL);
                                        checkUpdate(tempURL);
                                        loadClasses(tempURL);

                                        setShowSettings(false);
                                    }}
                                >
                                    <Text style={{ color: '#fff' }}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

/* =====================
   Styles 
===================== */
const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 360;
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#ffffff",
    },

    container: {
        padding: width * 0.05,
        flex: 1,
        justifyContent: "center",
    },

    logoContainer: {
        alignItems: "center",
        marginBottom: height * 0.02,
        width: width,
        marginLeft: -width * 0.05,
    },

    condorLogo: {
        width: "100%",
        height: scale(160),
    },

    logisticsText: {
        fontSize: scale(20),
        fontWeight: "900",
        color: "#0052cc",
        letterSpacing: 5,
        marginTop: 5,
        textTransform: "uppercase",
    },

    wmsText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#64748b",
        marginTop: 2,
        textAlign: "center",
        letterSpacing: 1,
    },

    header: {
        alignItems: "center",
        marginBottom: height * 0.01,
    },

    logoBox: {
        width: isSmallDevice ? 50 : 60,
        height: isSmallDevice ? 40 : 48,
        borderRadius: 12,
        backgroundColor: "#0052cc",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
    },

    logoText: {
        color: "#fff",
        fontSize: isSmallDevice ? scale(14) : scale(18),
        fontWeight: "900",
    },

    title: {
        fontSize: isSmallDevice ? scale(14) : scale(17),
        fontWeight: "800",
        color: "#0f172a",
        textAlign: "center",
    },

    subtitle: {
        fontSize: isSmallDevice ? scale(10) : scale(12),
        color: "#64748b",
    },

    form: {
        marginBottom: height * 0.015,
    },

    inputWrapper: {
        marginBottom: height * 0.012,
    },

    label: {
        fontSize: isSmallDevice ? scale(9) : scale(11),
        fontWeight: "700",
        marginBottom: 4,
    },

    inputContainer: {
        height: isSmallDevice ? 55 : 65,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: "#e2e8f0",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: width * 0.03,
    },

    inputFocused: {
        borderColor: "#0052cc",
    },

    inputIcon: {
        width: 20,
        height: 20,
        marginRight: 10,
        tintColor: "#64748b",
    },

    eyeIcon: {
        width: 24,
        height: 24,
        tintColor: "#64748b",
    },

    input: {
        flex: 1,
        fontSize: isSmallDevice ? scale(16) : scale(20),
        color: "#0f172a",
    },

    placeholderText: {
        color: "#94a3b8",
        fontSize: isSmallDevice ? scale(13) : scale(16),
    },

    chevronIcon: {
        fontSize: isSmallDevice ? scale(10) : scale(12),
        color: "#94a3b8",
    },

    buttonContainer: {
        gap: 10,
        marginTop: height * 0.02,
    },

    button: {
        height: isSmallDevice ? 44 : 50,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },

    primaryButton: {
        backgroundColor: "#0052cc",
    },

    primaryButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: isSmallDevice ? scale(16) : scale(18),
    },

    secondaryButton: {
        borderWidth: 2,
        borderColor: "#e2e8f0",
    },

    secondaryButtonText: {
        fontWeight: "700",
        fontSize: isSmallDevice ? scale(13) : scale(15),
    },

    gradientButton: {
        borderRadius: 10,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },

    modalContent: {
        backgroundColor: "#fff",
        width: width * 0.9,
        maxHeight: height * 0.6,
        borderRadius: 16,
        padding: width * 0.05,
    },

    modalTitle: {
        fontSize: isSmallDevice ? scale(14) : scale(17),
        fontWeight: "800",
        marginBottom: 12,
        textAlign: "center",
    },

    optionItem: {
        paddingVertical: height * 0.02,
        borderBottomWidth: 1,
        borderBottomColor: "#f1f5f9",
    },

    optionText: {
        fontSize: isSmallDevice ? scale(13) : scale(15),
        textAlign: "center",
    },

    /* ===== Info Box ===== */

    infoBox: {
        backgroundColor: "#f8fafc",
        padding: width * 0.02,
        borderRadius: 10,
        marginBottom: height * 0.001,
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },

    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    settingsIcon: {
        width: 25,
        height: 25,
        tintColor: "#64748b",
    },

    url: {
        fontSize: isSmallDevice ? scale(8) : scale(10),
        color: "#94a3b8",
        textAlign: "center",
        marginTop: 2,
    },

    version: {
        fontSize: isSmallDevice ? scale(13) : scale(14),
        fontWeight: "700",
        color: "#1e293b",
    },

    operateInfo: {
        borderBottomWidth: 1,
        borderBottomColor: "#e2e8f0",
        paddingBottom: 5,
        marginBottom: 5,
    },

    operateText: {
        fontSize: scale(12),
        color: "#64748b",
        fontWeight: "600",
    },

    settingsInput: {
        borderWidth: 1,
        borderColor: "#e2e8f0",
        borderRadius: 8,
        padding: 10,
        marginBottom: 20,
        fontSize: 16,
    },

    modalButtons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 10,
    },

    modalBtn: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 6,
    },

    cancelBtn: {
        backgroundColor: "#f1f5f9",
    },

    saveBtn: {
        backgroundColor: "#0052cc",
    },

    qrHint: {
        fontSize: scale(9),
        color: "#64748b",
        marginTop: 4,
        fontStyle: "italic",
    },

    loadingOverlay: {
        padding: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f1f5f9",
        borderRadius: 12,
        marginBottom: 15,
    },

    loadingText: {
        marginTop: 8,
        fontSize: scale(12),
        color: "#0052cc",
        fontWeight: "600",
    },
});