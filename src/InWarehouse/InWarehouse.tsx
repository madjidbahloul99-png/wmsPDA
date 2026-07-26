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
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as soapClient from "./soapClient";

const AnimatedView = Animated.View as any;

interface BoxItem {
    id: string;
    boxCode: string;
    model: string;
    color: string;
    boxQty: string;
}

export default function InWarehouse({ navigation }: any) {
    const {
        gs_MESBaseURL,
        gs_factoryCodeMES,
        gs_wareCode,
        gs_wareType,
        gs_classCode,
        gs_groupCode,
        gs_workdate,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
    } = useGlobalStr();

    const [sn, setSn] = useState("");
    const [palletCode, setPalletCode] = useState("");
    const [qty, setQty] = useState("");
    const [loading, setLoading] = useState(false);
    const [boxList, setBoxList] = useState<BoxItem[]>([]);
    const snInputRef = useRef<TextInput>(null);
    const isScanning = useRef(false);
    const scanTimer = useRef<any>(null);
    const borderAnim = useRef(new Animated.Value(0)).current;

     const [showKeyboard, setShowKeyboard] = useState(false);
     const [inputEnabled, setInputEnabled] = useState(true);

    const [scanState, setScanState] = useState<
        "waiting" | "scanning" | "success" | "error"
    >("waiting");

    // Pulse animation for keying scan
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

    // Verify WareType has "MainWarehouse" authority, else fallback
    useEffect(() => {
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
        } else {
            const checkConnection = async () => {
                setLoading(true);
                try {
                    await soapClient.HelloWorld(gs_MESBaseURL);
                    console.log("gs_MESBaseURL",gs_MESBaseURL)
                    setInputEnabled(true);
                    setTimeout(() => snInputRef.current?.focus(), 500);
                } catch (err) {
                    pubfunction.ShowError("Connect error,Please change URL link!");
                    //setInputEnabled(false);
                } finally {
                    setLoading(false);
                }
            };
            checkConnection();
        }
    }, [gs_wareType, gs_MESBaseURL]);

    const ensureFocus = () => {
        if (inputEnabled && gs_wareType === "MainWarehouse") {
            snInputRef.current?.focus();
        }
    };

    const handleScanWithValue = async (scanValue?: string) => {
        if (!inputEnabled || isScanning.current || loading) return;

        const currentSn = (scanValue || sn).toUpperCase().trim();
        if (!currentSn) return;

        isScanning.current = true;
        setLoading(true);

        if (gs_wareType !== "MainWarehouse") {
            Alert.alert("Error", "Only the main warehouse can be put in storage!");
            isScanning.current = false;
            setLoading(false);
            return;
        }

        try {
            setScanState("scanning");

            const rows = await soapClient.InBarcodeCheck(
                gs_MESBaseURL,
                gs_factoryCodeMES || "001",
                currentSn
            );

            console.log("rows",rows)

            if (rows && rows.length > 0) {
                const checkResult = {
                    isok: rows[0].isok,
                    palletCode: rows[0].palletCode,
                    scanType: rows[0].scanType,
                    retstr: rows[0].retstr
                };

                if (checkResult.isok === "1") {
                    setScanState("success");
                    const pCode = checkResult.palletCode;
                    const sType = checkResult.scanType;
                    setPalletCode(pCode);

                    // Navigate to confirmation dialog box screen
                    navigation.navigate("InWarehouseConfirmBox", {
                        palletCode: pCode,
                        sType: sType,
                        currentSn: currentSn
                    });
                    setSn(""); // Clear the scan input immediately on successful check before navigating
                } else {
                    setScanState("error");
                    pubfunction.ShowError(checkResult.retstr || "Connect error,Please change URL link!");
                    setSn(""); // Clear the scan input on failure
                }
            } else {
                setScanState("error");
                pubfunction.ShowError("here Data handling exceptions, please check!");
                setSn(""); // Clear the scan input on failure
            }
        } catch (err: any) {
            setScanState("error");
            pubfunction.ShowError("Connect error, Please change URL link!");
            setSn(""); // Clear the scan input on failure
        } finally {
            setLoading(false);
            isScanning.current = false;
        }
    };

    // Called when dialog confirms InPalletInsert
    const processPalletInsert = async (pCode: string, sType: string, originalSn: string) => {
        setLoading(true);
        try {
            const data = await soapClient.InPalletInsert(
                gs_MESBaseURL,
                gs_factoryCodeMES || "001",
                gs_wareCode,
                sType,
                pCode,
                originalSn,
                gs_classCode,
                gs_groupCode,
                gs_workdate,
                gs_userCode
            );

            if (data && data.length > 0) {
                if (data[0].isok === "1") {
                    setQty(String(data[0].totalQty || ""));
                    const mapped = data.map((item: any, index: number) => ({
                        id: index.toString(),
                        boxCode: item.scanBarcodeLarge,
                        model: item.model,
                        color: item.color,
                        boxQty: item.boxQty,
                    }));
                    setBoxList(mapped);
                    setPalletCode(pCode);
                } else {
                    pubfunction.ShowError(data[0].retstr || "Insert failed");
                }
            } else {
                pubfunction.ShowError("There is no product in the Pallet!");
            }
        } catch (err: any) {
            pubfunction.ShowError("Insert failed");
        } finally {
            setSn(""); // Clear the scan input on confirmation completion (success or failure)
            setLoading(false);
            setTimeout(() => snInputRef.current?.focus(), 100);
        }
    };

    // Setup confirmed event listener
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('ON_IN_WAREHOUSE_CONFIRM', (data) => {
            processPalletInsert(data.palletCode, data.sType, data.currentSn);
        });
        return () => sub.remove();
    }, [gs_wareCode, gs_classCode, gs_groupCode, gs_workdate, gs_userCode]);

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
            }, 600);
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
            <Text style={[styles.cell, { width: 80 }]}>{item.boxQty}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={handleReturn} activeOpacity={0.7}>
                        <Image
                            source={require("../../assets/logo/left.png")}
                            style={styles.returnLogo}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>In Warehouse: {gs_wareCode}</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{ gs_userName || gs_userCode}</Text>
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
                            elevation: 4,
                        }}>
                            <TextInput
                                ref={snInputRef}
                                style={[
                                    styles.input,
                                    (gs_wareType !== "MainWarehouse" || !inputEnabled) && styles.disabledInput,
                                    { borderWidth: 0, elevation: 0 }
                                ]}
                                value={sn}
                                onChangeText={handleSnChange}
                               // onSubmitEditing={handleSnSubmit}
                                placeholder="Scan / Input Barcode"
                                autoCapitalize="characters"
                                blurOnSubmit={false}
                                onBlur={ensureFocus}
                                editable={gs_wareType === "MainWarehouse" && inputEnabled}
                                placeholderTextColor="#64748B"
                                showSoftInputOnFocus={showKeyboard}
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
                                <Text style={[styles.headerCell, { width: 80 }]}>Qty</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>
                                {boxList.length === 0 ? (
                                    loading ? (
                                        <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                                    ) : (
                                        <Text style={styles.emptyText}>Waiting for barcode input...</Text>
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
                        <Text style={styles.btnTextPrimary}>Barcode  Details</Text>
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
    returnLogo: { width: scale(23), height: scale(23), marginRight: 10, tintColor: "#FFFFFF" },
    headerTitle: { color: "#FFFFFF", fontSize: isSmallDevice ? scale(13) : scale(15), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(11), fontWeight: "700" },
    content: { flex: 1, padding: 16 },
    formCard: {
        backgroundColor: "#FFF",
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: "#0052cc"
    },
    inputGroup: { marginTop: 6 },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#0052cc",
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 38,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: "#CBD5E1",
    },
    leftLabel: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "700",
    },
    rightValue: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "900",
    },
    input: { backgroundColor: "#e2f0eeff", height: 42, borderRadius: 10, paddingHorizontal: 15, fontSize: 13, color: "#1E293B", fontWeight: "700" },
    disabledInput: { backgroundColor: "#CBD5E1", color: "#64748B" },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", elevation: 3, borderWidth: 1, borderColor: "#0052cc", marginBottom: 12 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    footer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8 },
    actionBtn: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnPrimary: { backgroundColor: '#0052cc' },
    btnTextPrimary: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 350 },
});







































