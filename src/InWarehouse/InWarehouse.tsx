import React, { useState, useRef, useEffect, useCallback } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Alert,
    ScrollView,
    Image,
    Dimensions,
    DeviceEventEmitter,
    Animated,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AnimatedView = Animated.View as any;

interface BoxItem {
    id: string;
    boxCode: string;
    model: string;
    color: string;
    boxQty: string;
}

export default function InWarehouse({ navigation, route }: any) {
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_wareCode, gs_wareType,
        gs_classCode, gs_groupCode, gs_workdate, gs_userCode, gs_userName,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [sn, setSn] = useState("");
    const [palletCode, setPalletCode] = useState("");
    const [qty, setQty] = useState("");
    const [loading, setLoading] = useState(false);
    const [boxList, setBoxList] = useState<BoxItem[]>([]);
    const [showKeyboard] = useState(false);
    const snInputRef = useRef<TextInput>(null);
    const isScanning = useRef(false);
    const scanTimer = useRef<any>(null);
    const borderAnim = useRef(new Animated.Value(0)).current;

    const [scanState, setScanState] = useState<
        "waiting" | "scanning" | "success" | "error"
    >("waiting");

    useEffect(() => {

        let animation: Animated.CompositeAnimation | null = null;

        if (scanState === "waiting") {

            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(borderAnim, {
                        toValue: 1,
                        duration: 700,
                        useNativeDriver: false,
                    }),
                    Animated.timing(borderAnim, {
                        toValue: 0,
                        duration: 700,
                        useNativeDriver: false,
                    }),
                ])
            );

            animation.start();

        } else {
            borderAnim.setValue(1);
        }

        return () => {
            animation?.stop();
        };

    }, [scanState]);

    const animatedBorderColor = borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange:
            scanState === "waiting"
                ? ["#0052cc", "#60a5fa"]
                : scanState === "scanning"
                    ? ["#f59e0b", "#fbbf24"]
                    : scanState === "success"
                        ? ["#16a34a", "#4ade80"]
                        : ["#dc2626", "#f87171"],
    });

    const animatedBorderWidth = borderAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 4],
    });

    useFocusEffect(
        useCallback(() => {
            if (gs_wareType !== "MainWarehouse") {
                Alert.alert(
                    "Restricted Access",
                    "Only the main warehouse can be put in storage!",
                    [
                        {
                            text: "OK",
                            onPress: () => {
                                navigation.goBack();
                            },
                        },
                    ]
                );
                return;
            } else {
                setTimeout(() => snInputRef.current?.focus(), 500);
            }
        }, [gs_wareType])
    );

    useEffect(() => {

        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            console.log("TOKEN IN inwh", t);
            if (t) setToken(t);
        };

        loadToken();
    }, []);


    const ensureFocus = () => {
        if (!showKeyboard) {
            snInputRef.current?.focus();
        }
    };

    const handleScanWithValue = async (scanValue?: string) => {

        if (isScanning.current || loading) return;

        const currentSn = (scanValue || sn).toUpperCase().trim();
        if (!currentSn) return;

        isScanning.current = true;
        setLoading(true);
        setSn("");

        if (gs_wareType !== "MainWarehouse") {
            Alert.alert("Error", "Only the main warehouse can be put in storage!");
            isScanning.current = false;
            setLoading(false);
            return;
        }

        try {
            const checkRes = await fetch(`${BASE_URL}/api/InBarcodeCheck`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode, scanCode: currentSn
                }),
            });

            if (checkRes.status === 401) {
                Alert.alert("Unauthorized", "Token expired or invalid.");
                return;
            }

            if (checkRes.status === 403) {
                Alert.alert("Access Denied", "You do not have permission user here.");
                return;
            }
            const checkResult = await checkRes.json();

            if (checkResult.code === 500) {
                Alert.alert("Error", checkResult.message);
                //navigation.goBack();
                return;
            }

            console.log(checkResult);
            if (checkResult.message === "success" && checkResult.data) {
                const data = checkResult.data;
                if (data.isok === "1") {
                    setScanState("success");
                    const pCode = data.palletCode;
                    const sType = data.scanType;
                    setPalletCode(pCode);

                    navigation.navigate("InWarehouseConfirmBox", {
                        palletCode: pCode,
                        sType: sType,
                        currentSn: currentSn
                    });
                } else {
                    setScanState("error");

                    Alert.alert("Error", data.retstr || "Unknown error");
                }
            } else {
                setScanState("error");
                Alert.alert("Error", "Data handling exceptions, please check!");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
            isScanning.current = false;
        }
    };

    const processPalletInsert = async (pCode: string, sType: string, originalSn: string) => {
        console.log("processPalletInsert called with:", pCode, sType, originalSn);
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/InPalletInsert`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode,
                    wareHouseCode: gs_wareCode,
                    scanType: sType,
                    palletCode: pCode,
                    scanBarCode: originalSn,
                    classesCode: gs_classCode,
                    groupCode: gs_groupCode,
                    workdate: gs_workdate,
                    createUser: gs_userCode,
                }),
            });

            if (response.status === 401) {
                Alert.alert("Unauthorized", "Token expired or invalid.");
                return;
            }

            if (response.status === 403) {
                Alert.alert("Access Denied", "You do not have permission.");
                return;
            }

            const result = await response.json();

            if (result.code === 500) {
                Alert.alert("Error", result.message);
                navigation.goBack();
                return;
            }
            console.log(result);
            if (result.message === "success" && result.data && result.data.length > 0) {
                if (result.data[0].isok === "1") {
                    setQty(String(result.data[0].totalQty || result.data[0].qty || "0"));
                    const mapped = result.data.map((item: any, index: number) => ({
                        id: index.toString(),
                        boxCode: item.scanBarcodeLarge,
                        model: item.model,
                        color: item.color,
                        boxQty: item.boxQty,
                    }));
                    setBoxList(mapped);
                    setPalletCode(pCode);
                    Alert.alert("✅ Success", "Pallet added to stock successfully.");
                            

                } else {
                    Alert.alert("Error", result.data[0].retstr || "Insert failed");
                }
            } else {
                Alert.alert("Error", "There is no product in the Pallet!");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
            setTimeout(() => snInputRef.current?.focus(), 100);
        }
    };

    useEffect(() => {
        if (token) {
            const sub = DeviceEventEmitter.addListener('ON_IN_WAREHOUSE_CONFIRM', (data) => {
                console.log("Received ON_IN_WAREHOUSE_CONFIRM event:", data);
                processPalletInsert(data.palletCode, data.sType, data.currentSn);
            });
            return () => sub.remove();
        }
    }, [processPalletInsert, token]);

    const handleReturn = () => {
        navigation.goBack();
    };

    const handleSnChange = (text: string) => {
        setScanState("scanning");
        if (text.endsWith('\n') || text.endsWith('\r')) {
            const cleanSn = text.toUpperCase().trim();
            if (cleanSn.length > 0) {
                clearTimeout(scanTimer.current);
                handleScanWithValue(cleanSn);
            }
            return;
        }

        setSn(text);

        clearTimeout(scanTimer.current);

        if (text.trim().length > 0) {
            scanTimer.current = setTimeout(() => {
                const cleanSn = text.toUpperCase().trim();
                if (cleanSn.length > 0) {
                    handleScanWithValue(cleanSn);
                }
            }, 800);
        }
    };

    const handleSnSubmit = (e: any) => {
        const text = e.nativeEvent.text;
        const cleanSn = text.toUpperCase().trim();
        if (cleanSn.length > 0) {
            clearTimeout(scanTimer.current);
            handleScanWithValue(cleanSn);
        }
    };

    const renderItem = ({ item, index }: { item: BoxItem; index: number }) => (
        <View
            style={[
                styles.tableRow,
                index % 2 === 0
                    ? { backgroundColor: "#FFFFFF" }
                    : { backgroundColor: "#BAE6FD" }
            ]}
        >
            <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
            <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
            <Text style={[styles.cell, { width: 100 }]}>{item.boxQty}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={handleReturn} activeOpacity={0.7}>
                        <Image
                            source={require("../../assets/logo/left.png")}
                            style={styles.returnLogo}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Warehouse Scanning</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.formCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.leftLabel}>PALLET</Text>
                        <Text style={styles.rightValue}>{palletCode || "-"}</Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.leftLabel}>QTY</Text>
                        <Text style={styles.rightValue}>{qty || "0"}</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <AnimatedView style={{
                            borderRadius: 10,
                            borderWidth: animatedBorderWidth,
                            borderColor: animatedBorderColor,
                            backgroundColor: "#e2f0eeff",
                            elevation: 32,
                        }}>
                            <TextInput
                                ref={snInputRef}
                                style={[
                                    styles.input,
                                    gs_wareType !== "MainWarehouse" && styles.disabledInput,
                                    { borderWidth: 0, elevation: 0 } // Move border/elevation to parent Animated.View
                                ]}
                                value={sn}
                                onChangeText={handleSnChange}
                                onSubmitEditing={handleSnSubmit}
                                placeholder="Barcode"
                                autoCapitalize="characters"
                                showSoftInputOnFocus={showKeyboard}
                                blurOnSubmit={false}
                                onBlur={ensureFocus}
                                editable={gs_wareType === "MainWarehouse"}
                                placeholderTextColor="#334155"
                            />
                        </AnimatedView>
                    </View>
                </View>

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 150 }]}>Box Code</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>Qty</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {boxList.length === 0 ? (
                                    loading ? (
                                        <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                                    ) : (
                                        <Text style={styles.emptyText}>Waiting for scanning...</Text>
                                    )
                                ) : (
                                    boxList.map((item, index) => (
                                        <React.Fragment key={item.id || index}>
                                            {renderItem({ item, index })}
                                        </React.Fragment>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.btnPrimary]}
                        onPress={() => {
                            if (palletCode) {
                                navigation.navigate("InWarehouseSNBox", { palletCode });
                            } else {
                                Alert.alert("Notice", "Please scan a barcode first.");
                            }
                        }}
                    >
                        <Text style={styles.btnTextPrimary}>SN Details</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const { width } = Dimensions.get("window");
const isSmallDevice = width < 360;
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: {
        backgroundColor: "#0052cc",
        paddingHorizontal: width * 0.05,
        height: scale(56),
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        elevation: 4,
    },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
    headerTitle: { color: "#FFFFFF", fontSize: isSmallDevice ? scale(14) : scale(16), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700", marginRight: 1 },
    content: { flex: 1, padding: 16 },
    formCard: {
        backgroundColor: "#FFF",
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        elevation: 32,
        borderWidth: 1,
        borderColor: "#0052cc"
    },
    inputGroup: { marginBottom: 6 },
    label: { fontSize: 10, fontWeight: "700", color: "#64748B", marginBottom: 4, textTransform: "uppercase", },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#0052cc",
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 35,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: "#CBD5E1",
    },
    leftLabel: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "700",
        textAlign: "left",
    },
    rightValue: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "900",
        textAlign: "right",
    },
    input: { backgroundColor: "#e2f0eeff", height: 40, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: "#334155", fontWeight: "600", borderWidth: 1, borderColor: "#0052cc", elevation: 32, },
    disabledInput: { backgroundColor: "#0052cc", color: "#FFFFFF" },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", elevation: 32, borderWidth: 1, borderColor: "#0052cc", marginBottom: -4 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    footer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 2 },
    actionBtn: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 12, marginBottom: -6 },
    btnPrimary: { backgroundColor: '#0052cc' },
    btnTextPrimary: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 400 },
});