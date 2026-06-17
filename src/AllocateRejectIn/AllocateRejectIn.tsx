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
    Keyboard,
    FlatList,
    Platform,
    Image,
    Dimensions,
    ScrollView,
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
    systemAllocateCode: string;
    allocateCode: string;
}

export default function AllocateRejectIn({ navigation }: any) {
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_wareCode, gs_classCode, gs_groupCode, gs_workdate, gs_userCode, gs_userName ,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
    } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [sn, setSn] = useState("");
    const [qty, setQty] = useState("");
    const [sysBill, setSysBill] = useState("");
    const [loading, setLoading] = useState(false);
    const [boxList, setBoxList] = useState<BoxItem[]>([]);
    const [allocateCode, setAllocateCode] = useState("");
    const [showKeyboard, setShowKeyboard] = useState(false);
    const snInputRef = useRef<TextInput>(null);
    const isScanning = useRef(false);
    const scanTimer = useRef<any>(null);
    const borderAnim = useRef(new Animated.Value(0)).current;

    const [scanState, setScanState] = useState<
        "waiting" | "scanning" | "success" | "error">("waiting");

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


    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            console.log("TOKEN IN reject", t);
            if (t) setToken(t);
        };

        loadToken();
    }, []);


    useFocusEffect(
        useCallback(() => {
            const timer = setTimeout(() => {
                snInputRef.current?.focus();
            }, 500);
            return () => clearTimeout(timer);
        }, [])
    );

    const ensureFocus = () => {
        if (snInputRef.current) {
            snInputRef.current.focus();
        }
    };



    const handleScan = async (scanValue?: string) => {
        if (isScanning.current || loading) return;

        const currentSn = (scanValue || sn).toUpperCase().trim();
        if (!currentSn) return;

        isScanning.current = true;
        setLoading(true);
        setSn("");

        try {
            const typeRes = await fetch(`${BASE_URL}/api/BarcodeType`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({ 
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode, scanCode: currentSn }),
            });

            if (typeRes.status === 401) {
                setScanState("error");
                Alert.alert("Unauthorized", "Token expired or invalid.");
                return;
            }

            if (typeRes.status === 403) {
                setScanState("error");
                Alert.alert("Access Denied", "You do not have permission.");
                return;
            }
            const typeResult = await typeRes.json();
            if (typeResult.code === 500) {
                setScanState("error");
                Alert.alert("Error", typeResult.message);
                navigation.goBack();
                return;
            }
            let scanType = "";
            if (typeResult.message === "success" && typeResult.data && typeResult.data.length > 0) {
                scanType = typeResult.data[0].scanType;
            }

            //CHANGE IT TO SN
            if (!scanType ) {
               scanType = "pallet";
            }

            if (scanType === "pallet" || scanType === "box") {
                setScanState("success");
                navigation.navigate("AllocateRejectInSNConfirmBox", {
                    barCode: currentSn,
                    scanType: scanType,
                    allocateCode: "",
                });
                isScanning.current = false;
                setLoading(false);
                return;
            } else if (scanType === "sn") {
                setScanState("success");
                navigation.navigate("AllocateRejectInSNConfirm", {
                    sn: currentSn,
                    scanType: scanType,
                    allocateCode: "",
                    showConfirm: true,
                });
                isScanning.current = false;
                setLoading(false);
                return;
            }

            processPalletDeal(currentSn, scanType, allocateCode);

        } catch (err: any) {
            setScanState("error");
            Alert.alert("Error", err.message);
            setLoading(false);
        } finally {
            isScanning.current = false;
        }
    };

    const handleSnChange = (text: string) => {
        if (text.trim() === "") {
            setScanState("waiting");
        } else {
            setScanState("scanning");
        }
        if (text.endsWith('\n') || text.endsWith('\r')) {
            const cleanSn = text.toUpperCase().trim();
            if (cleanSn.length > 0) {
                clearTimeout(scanTimer.current);
                handleScan(cleanSn);
            }
            return;
        }

        setSn(text);

        clearTimeout(scanTimer.current);

        if (text.trim().length > 0) {
            scanTimer.current = setTimeout(() => {
                const cleanSn = text.toUpperCase().trim();
                if (cleanSn.length > 0) {
                    handleScan(cleanSn);
                }
            }, 800); // 800ms delay for PDA stability
        }
    };

    const handleSnSubmit = (e: any) => {
        const text = e.nativeEvent.text;
        const cleanSn = text.toUpperCase().trim();
        if (cleanSn.length > 0) {
            clearTimeout(scanTimer.current);
            handleScan(cleanSn);
        }
    };

    const processPalletDeal = async (barCode: string, scanType: string, currentAllocateCode: string) => {
        setLoading(true);
        setBoxList([]);
        try {

            const response = await fetch(`${BASE_URL}/api/AllocateInInsertReject`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode,
                    wareHouseCode: gs_wareCode,
                    allocateCode: currentAllocateCode,
                    barCode: barCode,
                    scanType: scanType,
                    classCode: gs_classCode,
                    groupCode: gs_groupCode,
                    workdate: gs_workdate,
                    createUser: gs_userCode,
                }),
            });

            if (response.status === 401) {
                setScanState("error");
                Alert.alert("Unauthorized", "Token expired or invalid.");
                return;
            }

            if (response.status === 403) {
                setScanState("error");
                Alert.alert("Access Denied", "You do not have permission.");
                return;
            }

            const result = await response.json();
            if (result.code === 500) {
                setScanState("error");
                Alert.alert("Error", result.message);
                navigation.goBack();
                return;
            }
            console.log("rturn", result);
            if (result.message === "success" && result.data && result.data.length > 0) {
                if (result.data[0].isOk === "1") {
                    setScanState("success");
                    setQty(result.data[0].totalQty || "0");

                    const mapped = result.data.map((item: any, index: number) => {
                        setSysBill(item.systemAllocateCode || "");
                        return {
                            id: `${item.boxCode}-${index}`,
                            boxCode: item.boxCode,
                            model: item.model,
                            color: item.color,
                            boxQty: item.boxQty,
                            systemAllocateCode: item.systemAllocateCode,
                            allocateCode: item.allocateCode,
                        };
                    });
                    setBoxList(mapped);
                    Alert.alert("Success", "Operation completed successfully!");
                } else {
                    setScanState("error");
                    Alert.alert("Error", result.data[0].retStr);
                }
            } else {
                setScanState("error");
                Alert.alert("Error", "There is no product in the Pallet!");
            }
        } catch (err: any) {
            setScanState("error");
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
            setTimeout(() => snInputRef.current?.focus(), 100);
        }
    };

    useEffect(() => {
        if (token) {
            const subscription = DeviceEventEmitter.addListener(
                "ON_ALLOCATE_REJECT_CONFIRM",
                (data) => {
                    if (data.action === "OK") {
                        setAllocateCode(data.allocateCode);
                        processPalletDeal(data.barCode, data.scanType, data.allocateCode);
                    } else {
                        setLoading(false);
                        // Don't clear everything on cancel, just reset loading and focus
                        setTimeout(() => snInputRef.current?.focus(), 100);
                    }
                }
            );
            return () => subscription.remove();
        }

    }, [gs_factoryCode, gs_wareCode, gs_classCode, gs_groupCode, gs_workdate, gs_userCode, BASE_URL, token]);



    const handleReturn = () => {
        navigation.goBack();
    };

    const renderItem = ({ item, index }: { item: BoxItem, index: number }) => (
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
            <Text style={[styles.cell, { width: 60 }]}>{item.boxQty}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.systemAllocateCode}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.allocateCode}</Text>
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
                    <Text style={styles.headerTitle}>Allocation Reject In</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.card}>
                <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Bill NO</Text>
                    <Text style={styles.statValue}>{sysBill || "-"}</Text>
                </View>
                <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Total Qty</Text>
                    <Text style={styles.statValue}>{qty || "0"}</Text>
                </View>
                <AnimatedView style={{
                    borderRadius: 10,
                    borderWidth: animatedBorderWidth,
                    borderColor: animatedBorderColor,
                    backgroundColor: "#e2f0eeff",
                    elevation: 2,
                }}>
                    <TextInput
                        ref={snInputRef}
                        style={[styles.input, { borderWidth: 0, elevation: 0 }]}
                        value={sn}
                        onChangeText={handleSnChange}
                        placeholder="Barcode"
                        placeholderTextColor="#334155"
                        onSubmitEditing={handleSnSubmit}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        showSoftInputOnFocus={showKeyboard}
                        blurOnSubmit={false}
                        onBlur={ensureFocus}
                    />
                </AnimatedView>
            </View>

            <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, { width: 150 }]}>Box Code</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                            <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                            <Text style={[styles.headerCell, { width: 60 }]}>Qty</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>SAP Bill</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>Allocate Code</Text>
                        </View>

                        <FlatList
                            data={boxList}
                            renderItem={({ item, index }) => renderItem({ item, index })}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={() => (
                                loading ? (
                                    <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                                ) : (
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>Waiting for scanning...</Text>
                                    </View>
                                )
                            )}
                            keyboardShouldPersistTaps="handled"
                        />
                    </View>
                </ScrollView>
            </View>

            <View style={styles.footer}>
                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.btnPrimary]}
                        onPress={() => {
                            if (allocateCode) {
                                navigation.navigate("AllocateInSNBox", {
                                    allocateCode: allocateCode + "-AllocateRejIn"
                                });
                            } else {
                                Alert.alert("Notice", "Please scan a barcode first.");
                            }
                        }}
                    >
                        <Text style={styles.btnTextPrimary}>Barcode Details</Text>
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
    card: { backgroundColor: "#FFF", borderRadius: 16, padding: 10, marginHorizontal: 8, marginTop: 8, marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: "#0052cc" },
    statRow: {
        backgroundColor: "#0052cc",
        paddingHorizontal: 12,
        paddingVertical: 2,
        borderRadius: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        height: 40,
    },
    statLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
    input: { height: 40, backgroundColor: "#e2f0eeff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 0, fontSize: 14, fontWeight:700, color: "#1E293B", borderWidth: 1, borderColor: "#0052cc" },
    tableCard: { flex: 1, backgroundColor: "#FFF", marginHorizontal: 8, borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#0052cc", marginBottom: -4 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    listContent: { paddingBottom: 20 },
    tableRow: { flexDirection: "row", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    cellMain: { fontSize: 11, color: "#1E293B", fontWeight: "700", textAlign: "center" },
    cellSub: { fontSize: 10, color: "#64748B", textAlign: "center" },
    footer: { padding: 16 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnPrimary: { backgroundColor: '#0052cc' },
    btnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '800' },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#94a3b8', fontWeight: '600', fontSize: 14, fontStyle: "italic" },
});
