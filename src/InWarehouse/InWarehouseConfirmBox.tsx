import React, { useState, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    FlatList,
    Alert,
    Image,
    Dimensions,
    ScrollView,
    DeviceEventEmitter,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ConfirmItem {
    id: string;
    fxh: string;
    boxCode: string;
    qty: string;
    model: string;
    color: string;
    orderCode: string;
}

export default function InWarehouseConfirmBox({ navigation, route }: any) {
    const { palletCode, sType, currentSn, onConfirm } = route.params || {};
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName, gs_wareType,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
    } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(true);
    const [dataList, setDataList] = useState<ConfirmItem[]>([]);
    const [totalQty, setTotalQty] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            console.log("TOKEN IN Allocateout", t);
            if (t) setToken(t);
        };

        loadToken();
    }, []);





    const fetchDetails = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/InPalletSNConfirmBox`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode,
                    palletCode: palletCode,
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
            console.log("confirmbox", result)
            if (result.message === "success" && result.data && result.data.length > 0) {
                let total = 0;
                const mapped = result.data.map((item: any, index: number) => {
                    const q = parseInt(item.qty || "0");
                    total += q;
                    return {
                        id: index.toString(),
                        fxh: item.fxh,
                        boxCode: item.boxCode,
                        qty: item.qty,
                        model: item.model,
                        color: item.color,
                        orderCode: item.orderCode,
                    };
                });
                setDataList(mapped);
                setTotalQty(total);
            } else {
                Alert.alert("Error", "There is no product in the Pallet!");
                setDataList([]);
                setTotalQty(0);
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            if (gs_wareType !== "MainWarehouse") {
                Alert.alert("Error", "Only the main warehouse can be put in storage!");
                navigation.goBack();
                return;
            }
            fetchDetails();
        }
    }, [token]);

    const handleConfirm = () => {
        console.log("handleConfirm triggered in InWarehouseConfirmBox, onConfirm exists:", !!onConfirm);
        if (dataList.length >= 1) {
            Alert.alert(
                "Confirm Storage",
                "Are you sure you want to put this pallet in storage?",
                [
                    {
                        text: "Cancel",
                        style: "cancel",
                    },
                    {
                        text: "Confirm",
                        onPress: () => {
                            console.log("handleConfirm: emitting ON_IN_WAREHOUSE_CONFIRM and going back");
                            DeviceEventEmitter.emit('ON_IN_WAREHOUSE_CONFIRM', {
                                palletCode,
                                sType,
                                currentSn
                            });
                            navigation.goBack();
                        },
                    },
                ],
                { cancelable: true }
            );
        } else {
            Alert.alert("Message", "No items to confirm.");
        }
    };

    const handleCancel = () => {
        navigation.goBack();
    };

    const handleSNDetails = () => {
        if (!selectedId) {
            Alert.alert("Notice", "Please select a box from the list.");
            return;
        }
        const selectedItem = dataList.find(item => item.id === selectedId);
        if (selectedItem) {
            navigation.navigate("InWarehouseSNConfirm", {
                palletCode: palletCode,
                boxCode: selectedItem.boxCode,
                showConfirm: false
            });
        }
    };

    const renderItem = ({ item, index }: { item: ConfirmItem; index: number }) => (

        <TouchableOpacity
            style={[
                styles.tableRow,
                index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#BAE6FD" },
                selectedId === item.id && styles.selectedRow
            ]}

            onPress={() => setSelectedId(item.id)}
            activeOpacity={0.7}
        >
            <Text style={[styles.cell, { width: 50 }]}>{item.fxh}</Text>
            <Text style={[styles.cell, { width: 150, color: "#0052cc" }]}>{item.boxCode}</Text>
            <Text style={[styles.cell, { width: 60 }]}>{item.qty}</Text>
            <Text style={[styles.cell, { width: 100 }]}>{item.model}</Text>
            <Text style={[styles.cell, { width: 80 }]}>{item.color}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.orderCode}</Text>
        </TouchableOpacity>
    )

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                        <Image
                            source={require("../../assets/logo/left.png")}
                            style={styles.returnLogo}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Scanning Confirm </Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.statsCard}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Total Qty</Text>
                        <Text style={styles.statValue}>{totalQty}</Text>
                    </View>

                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Pallet Code</Text>
                        <Text style={styles.statValue}>{palletCode}</Text>
                    </View>
                </View>

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 50 }]}>No</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>Box Code</Text>
                                <Text style={[styles.headerCell, { width: 60 }]}>Qty</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>Model</Text>
                                <Text style={[styles.headerCell, { width: 80 }]}>Color</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Order</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {loading ? (
                                    <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                                ) : (
                                    <FlatList
                                        data={dataList}
                                        renderItem={renderItem}
                                        keyExtractor={(item) => item.id}
                                        scrollEnabled={false}
                                        ListEmptyComponent={() => (
                                            <Text style={styles.emptyText}>No items found for this pallet.</Text>
                                        )}
                                    />
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footer}>
                    <View style={styles.buttonRow}>

                        <TouchableOpacity
                            style={[styles.actionBtn, styles.btnInfo, { flex: 1 }]}
                            onPress={handleSNDetails}
                        >
                            <Text style={styles.btnTextPrimary1}>SN Details</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionBtn, styles.btnPrimary, { flex: 1 }]}
                            onPress={handleConfirm}
                        >
                            <Text style={styles.btnTextPrimary}>Confirm</Text>
                        </TouchableOpacity>

                    </View>
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
    statsCard: { flexDirection: 'column', gap: 10, marginBottom: 16 },
    statBox: {
        backgroundColor: "#0052cc",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 40,
    },
    statLabel: { color: "#FFF", fontSize: 12, fontWeight: "700", textTransform: "uppercase", paddingBottom: -10, textAlignVertical: "center" },
    statValue: { color: "#FFF", fontSize: 12, fontWeight: "800" },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16, marginTop: -8 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    selectedRow: { backgroundColor: "#ffc3c3ff" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    cellMain: { fontSize: 11, color: "#1E293B", fontWeight: "700", textAlign: "center" },
    cellSub: { fontSize: 10, color: "#64748B", textAlign: "center" },
    footer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 2 },
    buttonRow: { flexDirection: 'row', gap: 10 },

    btnPrimary: { backgroundColor: '#2563eb' },
    btnInfo: { backgroundColor: '#BAE6FD' },
    btnTextPrimary: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    btnTextPrimary1: { color: '#1E293B', fontSize: 15, fontWeight: '700' },
    emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 400 },
    actionBtn: {
        flex: 1,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },

});

