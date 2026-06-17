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

interface BoxItem {
    id: string;
    boxCode: string;
    model: string;
    color: string;
    boxQty: string;
}

const AnimatedView = Animated.View as any;

export default function DeliveryReturn({ navigation, route }: any) {
    const { deliveryCode, systemDeliveryCode, tock } = route.params;
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_wareCode, gs_classCode, gs_groupCode, gs_workdate, gs_userCode, gs_userName,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
    } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [sn, setSn] = useState("");
    const [palletCode, setPalletCode] = useState("");
    const [qty, setQty] = useState("");
    const [loading, setLoading] = useState(false);
    const [boxList, setBoxList] = useState<BoxItem[]>([]);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
    const [showKeyboard] = useState(false);
    const [scanState, setScanState] = useState<
        "waiting" | "scanning" | "success" | "error"
    >("waiting");
    const snInputRef = useRef<TextInput>(null);
    const isScanning = useRef(false);
    const scanTimer = useRef<any>(null);
    const borderAnim = useRef(new Animated.Value(0)).current;

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
            if (t) setToken(t);
        };
        loadToken();
    }, []);

    useEffect(() => {
        if (!token || !deliveryCode) return;

        const deliveryDeal = async () => {
            setLoading(true);
            try {

                const response = await fetch(`${BASE_URL}/api/DeliveryReturnCheck`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                        FactoryCode: gs_factoryCode,
                        DeliveryCode: deliveryCode,
                        ToWareHouse: gs_wareCode
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
                console.log("deliverCHECK", result)
                if (result.message === "success" && result.data) {
                    const data = result.data;
                    if (data.isOk !== "1") {
                        Alert.alert("Error", data.retstr || "Delivery Check Error");
                        navigation.goBack();
                    }
                } else {
                    Alert.alert("Error", "Data handling exceptions, please check!");
                    navigation.goBack();
                }
            } catch (err: any) {
                Alert.alert("Error", "Data handling exceptions, please check!");
                navigation.goBack();
            } finally {
                setLoading(false);
            }
        };

        deliveryDeal();
    }, [token, deliveryCode, gs_factoryCode, gs_wareCode, BASE_URL, navigation]);

    useFocusEffect(
        useCallback(() => {
            setTimeout(() => snInputRef.current?.focus(), 500);
        }, [])
    );

    const ensureFocus = () => {
        if (!showKeyboard) {
            snInputRef.current?.focus();
        }
    };

    const handleScanWithValue = async (scanValue?: string) => {
        if (isScanning.current || loading) return;

        const SN = (scanValue || sn).toUpperCase().trim();
        if (!SN) return;

        setScanState("scanning");
        isScanning.current = true;
        setLoading(true);
        //setSn("");

        try {
            // Correspond to C# getType(SN) which calls pub.BarcodeType
            const typeRes = await fetch(`${BASE_URL}/api/BarcodeType`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode,
                    scanCode: SN
                }),
            });

            if (typeRes.status === 401) {
                setScanState("error");
                Alert.alert("Unauthorized", "Token expired or invalid.");
                return;
            }

            const typeResult = await typeRes.json();

            if (typeResult.code === 500) {
                setScanState("error");
                Alert.alert("Error", typeResult.message);
                navigation.goBack();
                return;
            }
            console.log("deliverytypescan", typeResult)
            if (typeResult.message === "success" && typeResult.data) {
                let scanType = (typeResult.data.scanType || "").toLowerCase();
                if (scanType === "") { scanType = "pallet" }

                if (scanType === "pallet" || scanType === "box") {
                    setScanState("success");
                    navigation.navigate("DeliveryReturnSNConfirmBox", {
                        palletCode: SN,
                        sType: scanType,
                        currentSn: SN,
                        deliveryCode,
                        systemDeliveryCode,
                        tock
                    });
                } else if (scanType === "sn") {
                    setScanState("success");
                    navigation.navigate("DeliveryReturnSNConfirm", {
                        palletCode: "",
                        sType: scanType,
                        currentSn: SN,
                        deliveryCode,
                        systemDeliveryCode,
                        tock
                    });
                } else {
                    processDeliveryReturnInsert(SN, scanType, SN);
                }
            } else {
                setScanState("error");
                Alert.alert("Error", "Data handling exceptions, please check!");
            }
        } catch (err: any) {
            setScanState("error");
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
            isScanning.current = false;
        }
        setSn("");
    };

    const processDeliveryReturnInsert = async (pCode: string, sType: string, originalSn: string) => {
        setLoading(true);
        try {
            // Correspond to C# palletDeal which calls pub.DeliveryReturnInsert
            const response = await fetch(`${BASE_URL}/api/DeliveryReturnInsert`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode,
                    wareHouseCode: gs_wareCode,
                    scanType: sType,
                    barCode: originalSn,
                    classesCode: gs_classCode,
                    groupCode: gs_groupCode,
                    workdate: gs_workdate,
                    createUser: gs_userCode,
                    deliveryCode: deliveryCode
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

            if (result.message === "success" && result.data && result.data.length > 0) {
                const firstRow = result.data[0];
                if (firstRow.isok === "1") {
                    setScanState("success");
                    setQty(String(firstRow.totalQty || "0"));
                    const isfinish = String(firstRow.isfinish || "0");

                    const mapped = result.data.map((item: any, index: number) => ({
                        id: index.toString(),
                        boxCode: item.boxCode || item.scanBarcodeLarge,
                        model: item.model,
                        color: item.color,
                        boxQty: item.boxQty,
                    }));
                    setBoxList(mapped);
                    setPalletCode(pCode);

                    if (isfinish === "1") {
                        Alert.alert("Message", "The delivery of documents has been completed a warehouse!");
                    }
                } else {
                    setScanState("error");
                    Alert.alert("Error", firstRow.retstr || "Insert failed");
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
            setTimeout(() => {
                snInputRef.current?.focus();
                setScanState("waiting");
            }, 1000);
        }
    };

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('ON_DELIVERY_RETURN_CONFIRM', (data) => {
            processDeliveryReturnInsert(data.palletCode, data.sType, data.currentSn);
        });
        const cancelSub = DeviceEventEmitter.addListener('ON_DELIVERY_RETURN_CANCEL', () => {
            // Correspond to C# isok != DialogResult.OK clearing logic
            setQty("");
            setBoxList([]);
            setPalletCode("");
            setTimeout(() => snInputRef.current?.focus(), 100);
        });
        return () => {
            sub.remove();
            cancelSub.remove();
        };
    }, [processDeliveryReturnInsert]);

    const handleSnChange = (text: string) => {
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

    const renderItem = ({ item, index }: { item: BoxItem, index: number }) => (
        <TouchableOpacity
            key={item.id || index}
            style={[
                styles.tableRow,
                { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" },
                selectedItemIndex === index && styles.selectedRow
            ]}
            onPress={() => setSelectedItemIndex(index)}
            activeOpacity={0.7}
        >
            <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
            <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
            <Text style={[styles.cell, { width: 60 }]}>{item.boxQty}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                        <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Delivery Return</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.formCard}>
                    <View style={styles.compactBox}>
                        <Text style={styles.infoLabel}>TO</Text>
                        <Text style={styles.infoValue}>{gs_wareCode}</Text>
                    </View>
                    <View style={styles.compactBox}>
                        <Text style={styles.infoLabel}>QTY</Text>
                        <Text style={styles.infoValue}>{qty}</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <AnimatedView style={[
                            styles.animatedInputContainer,
                            {
                                borderColor: animatedBorderColor,
                                borderWidth: animatedBorderWidth,
                            }
                        ]}>
                            <TextInput
                                ref={snInputRef}
                                style={styles.input}
                                value={sn}
                                onChangeText={handleSnChange}
                                onSubmitEditing={handleSnSubmit}
                                placeholder="Barcode"
                                autoCapitalize="characters"
                                autoCorrect={false}
                                spellCheck={false}
                                showSoftInputOnFocus={showKeyboard}
                                blurOnSubmit={false}
                                onBlur={ensureFocus}
                                multiline={false}
                                scrollEnabled={false}
                                textAlignVertical="center"
                            //contextMenuHidden={true}
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
                                <Text style={[styles.headerCell, { width: 60 }]}>Qty</Text>
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
                                navigation.navigate("DeliveryReturnSNBox", { palletCode, deliveryCode });
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
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { backgroundColor: "#0052cc", paddingHorizontal: width * 0.05, height: scale(56), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
    headerTitle: { color: "#FFFFFF", fontSize: scale(16), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
    content: { flex: 1, padding: 12 },
    formCard: { backgroundColor: "#FFF", padding: 10, borderRadius: 12, marginBottom: 8, elevation: 2, borderWidth: 1, borderColor: "#0052cc" },
    compactBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: "#0052cc",
        height: 36,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#0052cc"
    },
    infoLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#FFFFFF",
        textTransform: "uppercase",
        flexShrink: 0
    },
    infoValue: {
        fontSize: 13,
        fontWeight: "800",
        color: "#FFFFFF",
        flexShrink: 1,
        textAlign: 'right'
    },
    inputGroup: { marginBottom: 0 },
    label: { fontSize: 10, fontWeight: "700", color: "#64748B", marginBottom: 2, textTransform: "uppercase" },
    input: {
        backgroundColor: "#e2f0eeff",
        height: 36,
        paddingHorizontal: 12,
        paddingVertical: 0,
        fontSize: 14,
        color: "#1E293B",
        fontWeight: "600",
        textAlignVertical: 'center'
    },
    animatedInputContainer: {
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
    },
    disabledInput: { backgroundColor: "#E2E8F0", color: "#64748B" },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#0052cc" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    selectedRow: { backgroundColor: "#ffc3c3ff" },
    footer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 2 },
    actionBtn: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
    btnPrimary: { backgroundColor: '#0052cc' },
    btnTextPrimary: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 400 },
});
