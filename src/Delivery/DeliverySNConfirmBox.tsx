import React, { useState, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Alert,
    ActivityIndicator,
    Image,
    Dimensions,
    TextInput,
    DeviceEventEmitter
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

type PalletDetail = {
    fxh: string;
    boxCode: string;
    qty: string;
    model: string;
    color: string;
    orderCode: string;
    palletCode: string;
};



export default function DeliverySNConfirmBox({ navigation, route }: any) {
    const { gsURL, setgs_gsURL } = useGlobal();
    const BASE_URL = gsURL;
    const { fromWareHouseCode, barCode, scanType, showConfirm } = route.params || {};
    const global = useGlobal();
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState<PalletDetail[]>([]);
    const [palletCode, setPalletCode] = useState("");
    const [boxCode, setBoxCode] = useState("");
    const [totalQty, setTotalQty] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            console.log("TOKEN IN Allocateout", t);
            if (t) setToken(t);
        };

        loadToken();
    }, []);

    useEffect(() => {
        if (token) {
            if (fromWareHouseCode && barCode && scanType) {
                fetchPalletDetails();
            }
        }
    }, [fromWareHouseCode, barCode, scanType, token]);

    const fetchPalletDetails = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/DeliveryPalletSNConfirmBox`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    factoryCode: global.gs_factoryCode,
                    fromWareHouseCode: fromWareHouseCode,
                    barCode: barCode,
                    scanType: scanType
                })
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
            console.log("problem result", result);

            if (result.code === 500) {
                Alert.alert("Error", result.message);
                navigation.goBack();
                return;
            }
            if (result.message == "success" && result.data && result.data.length > 0) {
                const list: PalletDetail[] = result.data.map((item: any) => ({
                    fxh: item.fxh,
                    boxCode: item.boxCode,
                    qty: item.qty,
                    model: item.model,
                    color: item.color,
                    orderCode: item.orderCode,
                    palletCode: item.palletCode
                }));

                setDetails(list);
                setPalletCode(list[0].palletCode);
                setBoxCode(list[0].boxCode);

                const total = list.reduce((sum, item) => sum + parseInt(item.qty || "0"), 0);
                setTotalQty(total);
            } else {
                Alert.alert("Error", `There is no product in the ${scanType}!`);
                navigation.goBack();
                setTotalQty(0);
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to fetch details from server");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (details.length >= 1) {
            Alert.alert(
                "Confirmation",
                "Are you sure you want to confirm this operation?",
                [
                    {
                        text: "Cancel",
                        style: "cancel",
                    },
                    {
                        text: "Yes",
                        onPress: () => {
                            DeviceEventEmitter.emit(
                                'ON_DELIVERY_CONFIRM_OK',
                                {
                                    barCode,
                                    scanType
                                }
                            );
                            navigation.goBack();
                        }
                    }
                ]
            );
        } else {
            DeviceEventEmitter.emit(
                'ON_DELIVERY_CONFIRM_CANCEL'
            );
            navigation.goBack();
        }
    };

    const handleExit = () => {
        navigation.goBack();
    };

    const viewItemDetails = () => {
        if (selectedIndex === null) {
            Alert.alert("Selection", "Please select an item from the list first.");
            return;
        }

        const selectedItem = details[selectedIndex];
        navigation.navigate('DeliverySNConfirm', {
            fromWareHouseCode: global.gs_wareCode,
            palletCode: palletCode,
            boxCode: selectedItem.boxCode,
            SN: "",
            scanType: scanType,
            showConfirm: false
        });
    };

    const getQtyLabel = () => {
        const typeLabel = scanType === "pallet" ? "Pallet" : scanType === "box" ? "Box" : scanType;
        return `${typeLabel}: ${palletCode || "—"} Total qty: ${totalQty}`;
    };

    const columns = [
        { label: "No", width: 40 },
        { label: "Boxcode", width: 140 },
        { label: "Qty", width: 70 },
        { label: "Model", width: 130 },
        { label: "Color", width: 110 },
        { label: "Order", width: 160 },
    ];

    const totalTableWidth = columns.reduce((acc, col) => acc + col.width, 0);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={handleExit} activeOpacity={0.7}>
                        <Image
                            source={require("../../assets/logo/left.png")}
                            style={styles.returnLogo}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Delivery Confirm </Text>
                </View>

                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{global.gs_userName}</Text>
                </View>
            </View>

            <View style={styles.statsCard}>
                {scanType === "pallet" && (
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Pallet</Text>
                        <TextInput
                            style={styles.statInput}
                            value={palletCode}
                            onChangeText={setPalletCode}
                            placeholder="-"
                        />
                    </View>
                )}
                {(scanType === "sn" || scanType === "box") && (
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Box</Text>
                        <TextInput
                            style={styles.statInput}
                            value={boxCode}
                            onChangeText={setBoxCode}
                            placeholder="-"
                        />
                    </View>
                )}
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Total Qty</Text>
                    <Text style={styles.statValue}>{totalQty || "0"}</Text>
                </View>
            </View>

            {/* List Card */}
            <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View style={{ width: totalTableWidth }}>
                        <View style={styles.tableHeader}>
                            {columns.map((col) => (
                                <Text key={col.label} style={[styles.headerCell, { width: col.width }]}>
                                    {col.label}
                                </Text>
                            ))}
                        </View>

                        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>
                            {details.length > 0 ? (
                                details.map((item, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.row,
                                            { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" },
                                            selectedIndex === index && styles.selectedRow
                                        ]}
                                        onPress={() => setSelectedIndex(index)}
                                    >
                                        <Text style={[styles.cell, { width: columns[0].width }]}>{item.fxh}</Text>
                                        <Text style={[styles.cell, { width: columns[1].width }]}>{item.boxCode}</Text>
                                        <Text style={[styles.cell, { width: columns[2].width }]}>{item.qty}</Text>
                                        <Text style={[styles.cell, { width: columns[3].width }]}>{item.model}</Text>
                                        <Text style={[styles.cell, { width: columns[4].width }]}>{item.color}</Text>
                                        <Text style={[styles.cell, { width: columns[5].width }]}>{item.orderCode}</Text>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={[styles.emptyText, { width: totalTableWidth }]}>No data available</Text>
                            )}
                        </ScrollView>
                    </View>
                </ScrollView>
            </View>


            <View style={styles.footer}>
                <View style={styles.buttonRow}>

                    <TouchableOpacity
                        style={[styles.actionBtn, styles.btnSecondary]}
                        onPress={viewItemDetails}
                    >
                        <Text style={styles.btnTextSecondary}>Details</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, styles.btnPrimary]}
                        onPress={handleConfirm}
                    >
                        <Text style={styles.btnTextPrimary}>Confirm</Text>
                    </TouchableOpacity>
                </View>
            </View>

        </SafeAreaView>
    );
}

const { width, height } = Dimensions.get("window");
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
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    returnLogo: {
        width: scale(24),
        height: scale(24),
        marginRight: 10,
        tintColor: "#FFFFFF",
    },
    headerTitle: {
        color: "#FFFFFF",
        fontSize: isSmallDevice ? scale(14) : scale(16),
        fontWeight: "900",
    },
    headerRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    userNameText: {
        color: "#FFFFFF",
        fontSize: scale(12),
        fontWeight: "700",
        marginRight: 1,
    },
    statsCard: { padding: 12, gap: 10 },
    statBox: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#0052cc",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0"
    },
    statLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    statInput: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", padding: 0, height: 20, textAlign: 'right', flex: 1 },
    tableCard: { flex: 1, backgroundColor: "#FFF", marginHorizontal: 16, borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: -4 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    row: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 40, fontStyle: "italic" },
    footer: { padding: 12 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnPrimary: { backgroundColor: '#2563eb' },
    btnSecondary: { backgroundColor: '#BAE6FD', borderWidth: 1, borderColor: '#e2e8f0' },
    btnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '800' },
    btnTextSecondary: { color: '#475569', fontSize: 15, fontWeight: '700' },
    selectedRow: { backgroundColor: "#ffc3c3ff" },
});
