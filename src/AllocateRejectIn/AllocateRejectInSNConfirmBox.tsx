import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    StatusBar,
    Alert,
    Image,
    Dimensions,
    ScrollView,
    DeviceEventEmitter
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PalletBoxDetail {
    id: string;
    fxh: string;
    boxCode: string;
    qty: string;
    model: string;
    color: string;
    orderCode: string;
    allocateCode: string;
    systemAllocateCode: string;
    palletCode: string;
}

export default function AllocateRejectInSNConfirmBox({ navigation, route }: any) {
    const { barCode, scanType, allocateCode: initialAllocateCode } = route.params || {};
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName,operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<PalletBoxDetail[]>([]);
    const [qtyTotal, setQtyTotal] = useState(0);
    const [palletCode, setPalletCode] = useState("");
    const [systemBill, setSystemBill] = useState("");
    const [allocateCode, setAllocateCode] = useState(initialAllocateCode || "");
    const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);


    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            console.log("TOKEN IN AllocateIN", t);
            if (t) setToken(t);
        };

        loadToken();
    }, []);

    const fetchDetails = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/AllocateInPalletSNConfirmBoxInject`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode,
                    allocateCode: allocateCode,
                    barCode: barCode,
                    scanType: scanType,
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
            console.log("reject", result);
            if (result.message === 'success' && result.data && result.data.length > 0) {
                let total = 0;
                let currentPalletCode = "";
                let currentSystemAllocateCode = "";
                let currentAllocateCode = allocateCode;

                const mapped = result.data.map((item: any, index: number) => {
                    total += parseInt(item.qty || "0");
                    currentPalletCode = item.palletCode || "";

                    if (!currentAllocateCode) {
                        currentAllocateCode = item.allocateCode || "";
                    }
                    currentSystemAllocateCode = item.systemAllocateCode || "";

                    return {
                        id: index.toString(),
                        fxh: item.fxh,
                        boxCode: item.boxCode,
                        qty: item.qty,
                        model: item.model,
                        color: item.color,
                        orderCode: item.orderCode,
                        allocateCode: item.allocateCode,
                        systemAllocateCode: item.systemAllocateCode,
                        palletCode: item.palletCode,
                    };
                });
                setDetails(mapped);
                setQtyTotal(total);
                setPalletCode(currentPalletCode);
                setSystemBill(currentSystemAllocateCode);
                setAllocateCode(currentAllocateCode);
            } else {
                Alert.alert("Error", "There is no product in the Pallet!");
                setQtyTotal(0);
                DeviceEventEmitter.emit("ON_ALLOCATE_REJECT_CONFIRM", {
                    action: "OK",
                    barCode,
                    scanType,
                    allocateCode
                });

                navigation.goBack();
            }
        } catch (err: any) {
            Alert.alert("Error ", err.message);
            DeviceEventEmitter.emit("ON_ALLOCATE_REJECT_CONFIRM", {
                action: "CANCEL"
            });

            navigation.goBack();
        } finally {
            setLoading(false);
        }
    }, [barCode, scanType, gs_factoryCode, BASE_URL, token, navigation, allocateCode]);



    useEffect(() => {
        if (token) {
            fetchDetails();
        }
    }, [fetchDetails, token]);

    const handleReturn = () => {
        DeviceEventEmitter.emit("ON_ALLOCATE_REJECT_CONFIRM", {
            action: "CANCEL"
        });

        navigation.goBack();
    };

    const renderItem = ({ item, index }: { item: PalletBoxDetail, index: number }) => (
        <TouchableOpacity
            style={[
                styles.tableRow,
                index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#BAE6FD" },
                selectedRowIndex === index && { backgroundColor: "#ffc3c3ff" }
            ]}
            onPress={() => setSelectedRowIndex(index)}
            activeOpacity={0.7}
        >
            <Text style={[styles.cell, { width: 50 }]}>{item.fxh}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
            <Text style={[styles.cell, { width: 60 }]}>{item.qty}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
            <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.orderCode}</Text>
        </TouchableOpacity>
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
                    <Text style={styles.headerTitle}>Allocate return confirm</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.statsCard}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Total Qty</Text>
                    <Text style={styles.statValue}>{qtyTotal || "0"}</Text>
                </View>
                {palletCode ? (
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Pallet</Text>
                        <Text style={styles.statValue}>{palletCode}</Text>
                    </View>
                ) : null}
                {systemBill ? (
                    <View style={[styles.statBox, { backgroundColor: '#E0E7FF' }]}>
                        <Text style={[styles.statLabel, { color: '#4338CA',fontWeight:800,fontSize:13 }]}>SAP:</Text>
                        <Text style={{ color: '#4338CA', fontSize: 13 ,fontWeight:800}}>{systemBill}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, { width: 50 }]}>No</Text>
                            <Text style={[styles.headerCell, { width: 150 }]}>Box Code</Text>
                            <Text style={[styles.headerCell, { width: 60 }]}>Qty</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                            <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>Order</Text>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                        ) : (
                            <FlatList
                                data={details}
                                renderItem={renderItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingBottom: 20 }}
                            />
                        )}
                    </View>
                </ScrollView>
            </View>

            <View style={styles.footer}>
                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.btnSecondary]}
                        onPress={() => {
                            if (selectedRowIndex !== null) {
                                const selectedItem = details[selectedRowIndex];
                                navigation.navigate("AllocateRejectInSNConfirm", {
                                    allocateCode: allocateCode,
                                    palletCode: palletCode,
                                    boxCode: selectedItem.boxCode,
                                    sn: "",
                                    scanType: scanType,
                                    showConfirm: false
                                });
                            } else {
                                Alert.alert("Notice", "Please select a row first.");
                            }
                        }}
                    >
                        <Text style={styles.btnTextSecondary}>Barcode Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.btnPrimary]}
                        onPress={() => {
                            if (details.length >= 1) {
                                Alert.alert(
                                    "Confirmation",
                                    "Are you sure you want to confirm this operation?",
                                    [
                                        {
                                            text: "Cancel",
                                            style: "cancel"
                                        },
                                        {
                                            text: "Yes",

                                            onPress: () => {
                                                DeviceEventEmitter.emit("ON_ALLOCATE_REJECT_CONFIRM", {
                                                    action: "OK",
                                                    barCode,
                                                    scanType,
                                                    allocateCode
                                                });

                                                navigation.goBack();
                                            }

                                        }
                                    ]
                                );
                            } else {
                                navigation.goBack();
                            }
                        }}
                    >
                        <Text style={styles.btnTextPrimary}>Confirm</Text>
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
    statsCard: { padding: 12, gap: 6 },
    statBox: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#0052cc",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0"
    },
    statLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    tableCard: { flex: 1, backgroundColor: "#FFF", marginHorizontal: 16, borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: -4 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    cellMain: { fontSize: 11, color: "#1E293B", fontWeight: "700", textAlign: "center" },
    cellSub: { fontSize: 10, color: "#64748B", textAlign: "center" },
    footer: { padding: 16 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnPrimary: { backgroundColor: '#2563eb' },
    btnSecondary: { backgroundColor: '#BAE6FD', borderWidth: 1, borderColor: '#e2e8f0' },
    btnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '800' },
    btnTextSecondary: { color: '#475569', fontSize: 15, fontWeight: '700' },
});
