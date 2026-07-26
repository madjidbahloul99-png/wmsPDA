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
    Alert,
    TextInput,
    Dimensions,
    ActivityIndicator,
    Image,
    Linking,
    BackHandler
} from "react-native";
import { useGlobalStr } from "../GlobalStrContext";
import * as pubfunction from "./pubfunction";
import * as RNNetInfo from "react-native-network-info";

// Import assets
import calendarIcon from "../assets/logo/calendar-day.png";
import userIcon from "../assets/logo/user.png";
import lockIcon from "../assets/logo/lock.png";
import warehouseIcon from "../assets/logo/warehouse.png";
import condorLogo from "../assets/logo/condor_logo.png";

type WarehouseItem = {
    id: string;
    text: string;
    otherInfo?: string;
    factoryCode?: string;
    mes3g?: string;
    mesLan?: string;
};

type ClassItem = {
    id: string;
    text: string;
};

type CustomInputRef = {
    focus: () => void;
};

/**
 * Global general normalization function for keyboard wedge-emulated scanners.
 * On AZERTY/QWERTY scanners, rapid keyboard emulation timing often leads to shift-state race conditions.
 * Typically, trailing special characters (like * , - + / = ! ; :) and numeric blocks (like 1, 2, 3) 
 * get transposed when they are typed back-to-back at very high speeds.
 * For example, "123**" (typed on AZERTY requiring Shift and then releasing Shift) might get registered as "**123"
 * or vice versa, because the shift down/up events get interleaved with the keys.
 * This global helper detects these trailing transpositions and recovers the correct order.
 */
export const normalizeWedgePassword = (pass: string): string => {
    if (!pass) return "";

    // 1. Swap trailing AZERTY unshifted characters (*, -, +, /, =, !, ,, ;, :) and digit blocks
    // e.g. "**123" -> "123**"
    const patternEndSymbolDigit = /([*\-+/=!,,;: ]+)([0-9]+)$/;
    if (patternEndSymbolDigit.test(pass)) {
        return pass.replace(patternEndSymbolDigit, "$2$1");
    }

    // 2. Clear any stray carriage returns or other common wedge artifacts
    return pass.replace(/[\r\n]/g, "").trim();
};

export const getNormalizedPasswordCandidates = (pass: string): string[] => {
    if (!pass) return [""];
    const candidates = [pass];

    const corrected1 = normalizeWedgePassword(pass);
    if (corrected1 && !candidates.includes(corrected1)) {
        candidates.push(corrected1);
    }

    // Secondary candidate: Swap any trailing non-alphanumeric special characters with the last digits block
    const patternGeneralSymbolsDigits = /([!@#$%^&*()_+=\-[\]{};':",./<>?|]+)([0-9]+)$/;
    if (patternGeneralSymbolsDigits.test(pass)) {
        const matched = pass.match(patternGeneralSymbolsDigits);
        if (matched) {
            const symbols = matched[1];
            const digits = matched[2];
            // If symbols start with `@` (like "@**123"), keep it intact and only swap the trailing layout parts
            if (symbols.startsWith("@") && symbols.length > 1) {
                const subSymbols = symbols.substring(1);
                const correctedValue = pass.slice(0, -matched[0].length) + "@" + digits + subSymbols;
                if (!candidates.includes(correctedValue)) {
                    candidates.push(correctedValue);
                }
            } else {
                const correctedValue = pass.replace(patternGeneralSymbolsDigits, "$2$1");
                if (!candidates.includes(correctedValue)) {
                    candidates.push(correctedValue);
                }
            }
        }
    }

    return candidates;
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
            onFocus,
            icon,
        },
        ref
    ) => {
        const [showModal, setShowModal] = useState(false);
        const [isFocused, setIsFocused] = useState(false);
        const hiddenInputRef = useRef<TextInput>(null);

        const defaultInputRef = useRef<TextInput>(null);
        const resolvedRef = inputRef || defaultInputRef;
        const localValueRef = useRef(value || "");

        useEffect(() => {
            if (value !== localValueRef.current) {
                localValueRef.current = value || "";
                if (resolvedRef && 'current' in resolvedRef && resolvedRef.current) {
                    resolvedRef.current.setNativeProps({ text: value || "" });
                }
            }
        }, [value, resolvedRef]);

        useImperativeHandle(ref, () => ({
            focus: () => {
                if (isSelect) {
                    hiddenInputRef.current?.focus();
                } else {
                    resolvedRef?.current?.focus();
                }
            },
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
                            ref={resolvedRef}
                            value={value}
                            defaultValue={value}
                            onChangeText={(text) => {
                                localValueRef.current = text;
                                if (onChangeText) onChangeText(text);
                            }}
                            placeholder={placeholder}
                            placeholderTextColor="#94a3b8"
                            style={styles.input}
                            secureTextEntry={isPassword}
                            onFocus={() => {
                                setIsFocused(true);
                                if (onFocus) onFocus();
                            }}
                            onBlur={() => {
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
                                        item.id ?? item
                                    }
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.optionItem}
                                            onPress={() => handleSelect(item)}
                                        >
                                            <Text style={styles.optionText}>
                                                {item.text ?? item}
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
   Login Screen Identical
===================== */
export default function Login({ navigation }: any) {
    const {
        gs_BaseURL, setgs_BaseURL,
        gs_BaseURL_WEB,
        gs_PADURL, setgs_PADURL,
        gs_PADURL_WEB,
        gs_PasswordSalt,
        gs_randomNumber,
        gs_version,
        g_isRealUrl,
        setgs_wareCode, setgs_wareName, setgs_wareType,
        setgs_factoryCode, setgs_factoryCodeMES,
        setgs_classCode, setgs_className,
        setgs_workdate,
        setgs_groupCode, setgs_groupName,
        gs_userCode, setgs_userCode,
        gs_userName, setgs_userName,
        setgs_remark,
        setgs_IPAddress, setgs_MESBaseURL
    } = useGlobalStr();

    const [userVal, setUserVal] = useState("");
    const [passwordVal, setPasswordVal] = useState("");
    const [displayUserVal, setDisplayUserVal] = useState("");
    const scanTimer = useRef<any>(null);
    const lastKeyTime = useRef<number>(0);
    const [loading, setLoading] = useState(false);
    const [newVersionLabel, setNewVersionLabel] = useState("");

    const [classList, setClassList] = useState<ClassItem[]>([]);
    const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

    const [warehouseList, setWarehouseList] = useState<WarehouseItem[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseItem | null>(null);

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
        }, 120);
    };

    // Signature generator
    const getUserSign = (addchar: string) => {
        return pubfunction.GetUserSign(addchar);
    };

    // Handler for typing and barcode scanning
    const handleUserCodeChange = (text: string) => {
        const now = Date.now();
        lastKeyTime.current = now;

        clearTimeout(scanTimer.current);

        if (text.includes("\n") || text.includes("\r")) {
            const cleanCode = text.replace(/[\r\n]/g, "").trim();
            if (cleanCode.length > 0) {
                if (cleanCode.includes("|")) {
                    const parts = cleanCode.split("|");
                    const u = parts[0].trim();
                    let p = parts.slice(1).join("|").trim();
                    
                    // Normalize scanned/emulated characters transposition
                    p = normalizeWedgePassword(p);

                    setUserVal(u);
                    setDisplayUserVal(u);
                    setPasswordVal(p);
                    getWarehouseListByUser(u);
                    setTimeout(() => {
                        warehouseRef.current?.focus();
                    }, 150);
                } else {
                    setUserVal(cleanCode);
                    setDisplayUserVal(cleanCode);
                    getWarehouseListByUser(cleanCode);
                    passwordRef.current?.focus();
                }
            }
            return;
        }

        // Keep local display value in sync: mask/hide password while scanning
        if (text.includes("|")) {
            const parts = text.split("|");
            const u = parts[0].trim();
            setDisplayUserVal(u);
        } else {
            setDisplayUserVal(text);
        }

        if (text.includes("|")) {
            scanTimer.current = setTimeout(() => {
                const finalCode = text.replace(/[\r\n]/g, "").trim();
                const parts = finalCode.split("|");
                if (parts.length >= 2) {
                    const u = parts[0].trim();
                    let p = parts.slice(1).join("|").trim();
                    
                    // Normalize scanned/emulated characters transposition
                    p = normalizeWedgePassword(p);

                    setUserVal(u);
                    setDisplayUserVal(u);
                    setPasswordVal(p);
                    getWarehouseListByUser(u);
                    setTimeout(() => {
                        warehouseRef.current?.focus();
                    }, 150);
                }
            }, 300);
        } else {
            // Standard user entry
            setUserVal(text);
        }
    };

    // Load Classes
    const getClassListJava = async (baseURL: string) => {
        try {
            const signParams = getUserSign("?");
            const url = `${baseURL}/basedata/class/getComboList${signParams}`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            if (data && data.list) {
                const list = typeof data.list === 'string' ? JSON.parse(data.list) : data.list;
                const mapped = list.map((c: any) => ({
                    id: c.id,
                    text: c.text
                }));
                setClassList(mapped);
                if (mapped.length > 0) {
                    setSelectedClass(mapped[0]);
                }
            } else if (data && !data.success) {
                pubfunction.ShowError(data.msg || "Failed to load classes list");
            }
        } catch (err) {
            pubfunction.ShowError("getClassListJava error");
        }
    };

    // Load warehouses by user code
    const getWarehouseListByUser = async (uCode: string) => {
        try {
            pubfunction.globalstr.gs_userCode = uCode;
            pubfunction.globalstr.gs_userName = uCode;
            let urlCur = `${gs_BaseURL}/basedata/warehouseAuth/getAuthWarehouseComb`;
            urlCur += pubfunction.GetUserSign("?");
            
            const res = await fetch(urlCur);
            const data = await res.json();
            
            if (data && data.list) {
                const list = typeof data.list === 'string' ? JSON.parse(data.list) : data.list;
                const mapped = list.map((w: any) => ({
                    id: w.id,
                    text: w.text,
                    otherInfo: w.otherInfo,
                    factoryCode: w.factoryCode,
                    mes3g: w.mes3g,
                    mesLan: w.mesLan
                }));
                setWarehouseList(mapped);
                if (mapped.length > 0) {
                    setSelectedWarehouse(mapped[0]);
                }
            } else if (data && !data.success) {
                pubfunction.ShowError(data.msg || "Failed to load warehouses");
            }
        } catch (err) {
            pubfunction.ShowError("getWarehouseListByUser error");
        }
    };

    // Authenticate user with selected warehouse
    const getUserInfoWarehouseAuth = async (uCode: string, pass: string, wCode: string, cCode: string) => {
        const candidates = getNormalizedPasswordCandidates(pass);
        let lastError = "Login details verification failed.";

        for (const pwdCandidate of candidates) {
            try {
                const operatorUser = uCode;
                const operatorUserName = "";
                
                const pwd = pubfunction.GetPasswordEncrypt(pwdCandidate);
                const signStr = pubfunction.MD5(operatorUser + operatorUserName + gs_randomNumber + gs_PasswordSalt);
                const language = "en_US";

                let url = `${gs_BaseURL}/user/doLoginWithWarehouse`;
                url += `?operatorUser=${operatorUser}`;
                url += `&operatorUserName=${operatorUserName}`;
                url += `&password=${pwd}`;
                url += `&warehouseCode=${wCode}`;
                url += `&classCode=${cCode}`;
                url += `&randomNumber=${gs_randomNumber}`;
                url += `&sign=${signStr}`;
                url += `&version=${gs_version}`;
                url += `&languageType=${language}`;

                const res = await fetch(url);
                const data = await res.json();
                 
                if (data && data.success) {
                    const vo = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                    setgs_userCode(uCode);
                    setgs_userName(vo?.userName || uCode);
                    setgs_remark(vo?.remark || "");
                    return { success: true, user: vo };
                } else {
                    lastError = data?.msg || "Login details verification failed.";
                }
            } catch (err: any) {
                pubfunction.ShowError("Login attempt failed for candidate");
                lastError = `Cannot verify credentials`;
            }
        }

        pubfunction.ShowError(lastError);
        return { success: false };
    };

    // Sync React standard global context parameters to the utility modules static object
    useEffect(() => {
        pubfunction.globalstr.gs_userCode = gs_userCode || "";
        pubfunction.globalstr.gs_userName = gs_userName || "";
        pubfunction.globalstr.gs_randomNumber = gs_randomNumber || "2";
        pubfunction.globalstr.gs_PasswordSalt = gs_PasswordSalt || "abc12345";
        pubfunction.globalstr.gs_version = gs_version || "1.0.0";
    }, [gs_userCode, gs_userName, gs_randomNumber, gs_PasswordSalt, gs_version]);

    // Component did mount / Frm_login_Load
    useEffect(() => {
        const loadFormConfig = async () => {
            try {
                // Check version update and classes list
                await getClassListJava(gs_BaseURL);

                // Set focus on usercode input
                setTimeout(() => {
                    userRef.current?.focus();
                    setActiveField("user");
                }, 500);

            } catch (err) {
                pubfunction.ShowError("Connect error, Please change URL link!");
            }
        };

        loadFormConfig();
    }, []);

    // Handle Login Button Click
    const handleLogin = async () => {
        if (!selectedWarehouse) {
            pubfunction.ShowError("The user does not have Warehouse permissions to operate!");
            return;
        }

        const mesURL = selectedWarehouse.mesLan || selectedWarehouse.mes3g;

        if (!mesURL) {
            pubfunction.ShowError("Please config warehouse url first !");
            return;
        }

        // Apply settings to context
        setgs_wareCode(selectedWarehouse.id);
        setgs_wareName(selectedWarehouse.text);
        setgs_wareType(selectedWarehouse.otherInfo || "");
        setgs_factoryCode(selectedWarehouse.factoryCode || "001");
        setgs_factoryCodeMES("001");
        setgs_MESBaseURL(mesURL);

        let finalClassCode = "BC01";
        let finalClassName = "Jour";
        if (selectedClass) {
            finalClassCode = selectedClass.id;
            finalClassName = selectedClass.text;
        }
        setgs_classCode(finalClassCode);
        setgs_className(finalClassName);

        const todayDate = new Date().toISOString().split("T")[0];
        setgs_workdate(todayDate);

        setgs_groupCode("BZ001");
        setgs_groupName("class A");

        setLoading(true);
        const loginRes = await getUserInfoWarehouseAuth(userVal, passwordVal, selectedWarehouse.id, finalClassCode);
        setLoading(false);

        if (loginRes.success) {
            try {
                const netInfo = RNNetInfo?.NetworkInfo;
                const ip = (netInfo && typeof netInfo.getIPAddress === "function")
                    ? await netInfo.getIPAddress()
                    : "127.0.0.1";
                setgs_IPAddress(ip || "127.0.0.1");
            } catch (err) {
                pubfunction.ShowError("Error retrieving IP Address, fallback to default:"+err);
                setgs_IPAddress("127.0.0.1");
            }
            navigation.navigate("Menu");
        }
    };



    // Download New Version Button Click
    const handleDownload = async () => {
        const confirmResult = await pubfunction.ShowConfirm("Are you sure download a new version replace old One, Restart again?");
        if (confirmResult) {
            if (gs_PADURL) {
                Linking.openURL(gs_PADURL);
            }
        }
    };

    return (
        <SafeAreaView style={styles.screen}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.container}>
                    {/* Header Logo */}
                    <View style={styles.logoContainer}>
                        <Image
                            source={condorLogo}
                            style={styles.condorLogo}
                            resizeMode="stretch"
                        />
                        <Text style={styles.wmsText}>GROUP WAREHOUSE MANAGEMENT</Text>

                        {/* Download & Version Container */}
                        <View style={styles.headerDownloadRow}>
                            <LinearGradient
                                colors={['#0052cc', '#22c55e']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.downloadGradientButton}
                            >
                                <TouchableOpacity
                                    onPress={handleDownload}
                                    style={styles.downloadButton}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.downloadButtonText}>Download new</Text>
                                </TouchableOpacity>
                            </LinearGradient>
                            <Text style={styles.headerVersion}>Version {gs_version}</Text>
                        </View>
                    </View>

                    {loading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color="#0052cc" />
                            <Text style={styles.loadingText}>Verifying credentials...</Text>
                        </View>
                    )}

                    <View style={styles.form}>
                        {/* Class selector */}
                        <CustomInput
                            ref={classRef}
                            label="Classes"
                            placeholder="Select Class"
                            value={selectedClass?.text}
                            onChangeText={(val: any) => {
                                setSelectedClass(val);
                                setActiveField("user");
                                setTimeout(() => userRef.current?.focus(), 120);
                            }}
                            isSelect
                            options={classList}
                            onBlur={ensureFocus}
                            icon={calendarIcon}
                        />

                        {/* User ID */}
                        <CustomInput
                            label="User Code"
                            placeholder="Enter your ID"
                            value={displayUserVal}
                            onChangeText={handleUserCodeChange}
                            inputRef={userRef}
                            onFocus={() => setActiveField("user")}
                            onBlur={() => {
                                ensureFocus();
                                if (userVal) getWarehouseListByUser(userVal.trim());
                            }}
                            icon={userIcon}
                        />

                        {/* Password */}
                        <CustomInput
                            label="Password"
                            placeholder="••••••••"
                            value={passwordVal}
                            onChangeText={(text: string) => {
                                setPasswordVal(text);
                            }}
                            isPassword
                            inputRef={passwordRef}
                            onSubmitEditing={() => {
                                if (userVal) {
                                    getWarehouseListByUser(userVal.trim());
                                    setTimeout(() => {
                                        warehouseRef.current?.focus();
                                    }, 500);
                                }
                            }}
                            onFocus={() => setActiveField("password")}
                            onBlur={ensureFocus}
                            icon={lockIcon}
                        />

                        {/* Warehouse Selector */}
                        <CustomInput
                            ref={warehouseRef}
                            label="Warehouse"
                            placeholder="Select Warehouse"
                            value={selectedWarehouse?.text}
                            onChangeText={(val: any) => {
                                setSelectedWarehouse(val);
                            }}
                            isSelect
                            options={warehouseList}
                            onBlur={ensureFocus}
                            icon={warehouseIcon}
                        />
                    </View>



                    {/* Action buttons */}
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
                                <Text style={styles.primaryButtonText}>LogIn</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>
                </View>
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
    wmsText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#64748b",
        marginTop: 2,
        textAlign: "center",
        letterSpacing: 1,
    },
    form: {
        marginBottom: height * 0.015,
    },
    inputWrapper: {
        marginBottom: height * 0.012,
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
    primaryButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: isSmallDevice ? scale(16) : scale(18),
    },
    secondaryButton: {
        borderWidth: 2,
        borderColor: "#e2e8f0",
        backgroundColor: "#f8fafc",
    },
    secondaryButtonText: {
        fontWeight: "700",
        color: "#475569",
        fontSize: isSmallDevice ? scale(16) : scale(18),
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
        paddingVertical: 2,
    },
    apiStyle: {
        fontSize: isSmallDevice ? scale(12) : scale(14),
        fontWeight: "700",
        color: "#22c55e",
    },
    apiStyleTest: {
        color: "#ef4444",
    },
    urlStyle: {
        fontSize: isSmallDevice ? scale(12) : scale(13),
        fontWeight: "600",
        color: "#64748b",
    },
    version: {
        fontSize: isSmallDevice ? scale(13) : scale(14),
        fontWeight: "700",
        color: "#1e293b",
    },
    newVersionText: {
        fontSize: isSmallDevice ? scale(12) : scale(13),
        fontWeight: "700",
        color: "#ef4444",
    },
    headerDownloadRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
        gap: 12,
    },
    downloadGradientButton: {
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 6,
    },
    downloadButton: {
        justifyContent: "center",
        alignItems: "center",
    },
    downloadButtonText: {
        color: "#ffffff",
        fontSize: isSmallDevice ? scale(12) : scale(14),
        fontWeight: "700",
    },
    headerVersion: {
        fontSize: isSmallDevice ? scale(13) : scale(15),
        fontWeight: "700",
        color: "#1e293b",
    },
    loadingOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(255,255,255,0.75)",
        zIndex: 5,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 10,
        fontSize: 14,
        color: "#0052cc",
        fontWeight: "600",
    },
});
