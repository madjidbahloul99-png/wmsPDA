import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Image,
    Dimensions,
    ActivityIndicator,
    Alert,
    TextInput,
    DeviceEventEmitter,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobal } from "../../GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function DistributorReturn({ navigation, route }: any) {
    const { f_orderId: initialOrderId } = route.params || {};
    const global = useGlobal();
    const { 
        gsURL, gs_factoryCode, gs_userName, gs_wareCode, 
        gs_classCode, gs_groupCode, gs_workdate, gs_userCode 
    } = global;
    const BASE_URL = gsURL;

    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [txtSN, setTxtSN] = useState("");
    const [f_orderId, setFOrderId] = useState(initialOrderId || "");
    const [txtToCk, setTxtToCk] = useState("");
    const [txtQty, setTxtQty] = useState("");
    const [itemList, setItemList] = useState<any[]>([]);

    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            if (t) setToken(t);
        };
        loadToken();
        
        const orderSub = DeviceEventEmitter.addListener('ON_DIST_ORDER_SELECTED', (data) => {
            if (data.f_orderId) {
                setFOrderId(data.f_orderId);
                distributorDeal(data.f_orderId);
            }
        });

        const confirmSub = DeviceEventEmitter.addListener('ON_DIST_RETURN_CONFIRM', (data) => {
            // Re-check distributor if order ID changed in confirm screen
            if (data.orderId && data.orderId !== f_orderId) {
                setFOrderId(data.orderId);
                distributorDeal(data.orderId);
            }
        });

        setTimeout(() => inputRef.current?.focus(), 500);

        if (initialOrderId) {
            distributorDeal(initialOrderId);
        }

        return () => {
            orderSub.remove();
            confirmSub.remove();
        };
    }, [initialOrderId, f_orderId, token]);

    // Store barcode for after confirm
    const lastBarcode = useRef("");
    const lastScanType = useRef("");

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('ON_DIST_RETURN_CONFIRM', (data) => {
            if (lastBarcode.current) {
                palletDeal(lastBarcode.current, lastScanType.current, data.orderId || f_orderId);
                lastBarcode.current = "";
                lastScanType.current = "";
            }
        });
        return () => sub.remove();
    }, [f_orderId, token]);

    const distributorDeal = async (orderId: string) => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/DistributorReturnCheck`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    factoryCode: gs_factoryCode,
                    orderId: orderId,
                    wareHouseCode: gs_wareCode
                }),
            });

            const result = await response.json();

            if (result.message === "success" && result.data && result.data.length > 0) {
                const data = result.data[0];
                if (data.isok === "1") {
                    setTxtToCk(data.fromDistributor + " " + data.fromDistributorName);
                    return true;
                } else {
                    Alert.alert("Error", data.retstr || "Order check failed");
                    return false;
                }
            } else {
                Alert.alert("Error", "Data handling exceptions, please check!");
                return false;
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
            return false;
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const fetchScanType = async (barcode: string) => {
        try {
            const response = await fetch(`${BASE_URL}/api/BarcodeType`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ factoryCode: gs_factoryCode, barcode }),
            });
            const result = await response.json();
            if (result.message === "success" && result.data) {
                const data = Array.isArray(result.data) ? result.data[0] : result.data;
                return data.scanType || "";
            }
            return "";
        } catch (err) {
            return "";
        }
    };

    const txtSN_KeyDown = async () => {
        const barcode = txtSN.toUpperCase().trim();
        if (!barcode) return;
        if (!f_orderId) {
            Alert.alert("Notice", "Please select an Order ID first");
            navigation.navigate("DistributorReturnNo");
            return;
        }

        setTxtSN("");
        setLoading(true);

        try {
            const scanType = await fetchScanType(barcode);
            lastBarcode.current = barcode;
            lastScanType.current = scanType;
            
            navigation.navigate("DistributorReturnSNConfirm", {
                f_orderId: f_orderId,
                f_barCode: barcode,
                f_scanType: scanType
            });
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const palletDeal = async (barCode: string, scanType: string, orderId: string) => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/DistributorReturnInsert`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    factoryCode: gs_factoryCode,
                    wareHouseCode: gs_wareCode,
                    orderId: orderId,
                    barCode: barCode,
                    scanType: scanType,
                    classCode: gs_classCode,
                    groupCode: gs_groupCode,
                    workdate: gs_workdate,
                    userCode: gs_userCode
                }),
            });

            const result = await response.json();

            if (result.message === "success" && result.data && result.data.length > 0) {
                const data = result.data;
                const firstRow = data[0];
                
                if (firstRow.isok === "1") {
                    setTxtQty(firstRow.totalQty);
                    setItemList(data);
                    
                    if (firstRow.isfinish === "1") {
                        Alert.alert("Success", "The order of documents has been completed a warehouse!");
                    }
                } else {
                    Alert.alert("Error", firstRow.retstr || "Insertion failed");
                }
            } else {
                Alert.alert("Error", "There is no product in the Pallet!");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const btnSNmx_Click = () => {
        if (!f_orderId) return;
        navigation.navigate("DistributorReturnSN", { f_orderId: f_orderId });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} id="button_exit">
                        <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate("DistributorReturnNo")}>
                        <Text style={styles.headerTitle}>{f_orderId ? `Order: ${f_orderId}` : 'Select Order'}</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.inputSection}>
                    <View style={[styles.scanInputContainer, { marginBottom: 8 }]}>
                        <TextInput
                            ref={inputRef}
                            id="txtSN"
                            style={styles.scanInput}
                            placeholder="Scan Pallet/Box/SN..."
                            value={txtSN}
                            onChangeText={setTxtSN}
                            onSubmitEditing={txtSN_KeyDown}
                            blurOnSubmit={false}
                            placeholderTextColor="#1E293B"
                        />
                    </View>
                    <View style={styles.infoRow}>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>Distributor</Text>
                            <Text style={styles.infoValue} id="txtToCk">{txtToCk || '-'}</Text>
                        </View>
                        <View style={[styles.infoBox, { flex: 0.3 }]}>
                            <Text style={styles.infoLabel}>Total Qty</Text>
                            <Text style={styles.infoValue} id="txtQty">{txtQty || '0'}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 150 }]}>boxCode</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>model</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>color</Text>
                                <Text style={[styles.headerCell, { width: 70 }]}>boxQty</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {loading ? (
                                    <View style={{ width: 450, marginTop: 40 }}>
                                        <ActivityIndicator size="large" color="#0052cc" />
                                    </View>
                                ) : itemList.length === 0 ? (
                                    <View style={{ width: 450, padding: 40 }}>
                                        <Text style={styles.emptyText}>No data scanned!</Text>
                                    </View>
                                ) : (
                                    itemList.map((item, index) => (
                                        <View key={index} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" }]}>
                                            <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
                                            <Text style={[styles.cell, { width: 130 }]}>{item.model}</Text>
                                            <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
                                            <Text style={[styles.cell, { width: 70 }]}>{item.boxQty}</Text>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        id="btnSNmx"
                        style={styles.actionBtn}
                        onPress={btnSNmx_Click}
                    >
                        <Text style={styles.actionBtnText}>SN Detail</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { backgroundColor: "#0052cc", paddingHorizontal: width * 0.05, height: scale(56), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
    headerTitle: { color: "#FFFFFF", fontSize: scale(16), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
    content: { flex: 1, padding: 8 },
    inputSection: { marginBottom: 8 },
    scanInputContainer: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, height: 40, alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: '#0052cc' },
    scanInput: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1E293B' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
    infoBox: { flex: 0.68, backgroundColor: '#FFF', borderRadius: 10, padding: 8, elevation: 1, borderWidth: 1, borderColor: '#E2E8F0' },
    infoLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
    infoValue: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginTop: 2 },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 8 },
    headerCell: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600", paddingHorizontal: 4 },
    emptyText: { textAlign: "center", color: "#94A3B8", fontStyle: "italic" },
    footer: { marginTop: 8 },
    actionBtn: { backgroundColor: "#0052cc", padding: 12, borderRadius: 10, alignItems: "center", height: 44, elevation: 2 },
    actionBtnText: { color: "#FFF", fontWeight: "900", fontSize: 14 },
});
