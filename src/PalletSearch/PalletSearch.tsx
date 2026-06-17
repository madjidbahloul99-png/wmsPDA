import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    StatusBar,
    Alert,
    Image,
    Dimensions,
    ScrollView,
} from "react-native";
import { useGlobal } from "../../GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PalletBoxItem {
    id: string;
    fxh: string;
    palletCode: string;
    boxCode: string;
    qty: string;
    model: string;
    color: string;
    orderCode: string;
}

export default function PalletSearch({ navigation }: any) {
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_wareCode, gs_userName ,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
    } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [sn, setSn] = useState("");
    const [loading, setLoading] = useState(false);
    const [boxList, setBoxList] = useState<PalletBoxItem[]>([]);
    const [totalQty, setTotalQty] = useState(0);
    const [currentPallet, setCurrentPallet] = useState("");
    const [showKeyboard, setShowKeyboard] = useState(false);
    const [selectedItem, setSelectedItem] = useState<PalletBoxItem | null>(null);

    const snInputRef = useRef<TextInput>(null);
    const scanTimer = useRef<any>(null);

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            console.log("TOKEN IN Allocateout", t);
            if (t) setToken(t);
        };

        loadToken();
    }, []);

    useEffect(() => {
        snInputRef.current?.focus();
    }, []);

    const ensureFocus = () => {
        if (!showKeyboard) {
            snInputRef.current?.focus();
        }
    };

    const handleBarcodeChange = (text: string) => {
        setSn(text);
        clearTimeout(scanTimer.current);

        if (text.endsWith("\n") || text.endsWith("\r")) {
            const cleanCode = text.trim();
            if (cleanCode.length > 0) {
                setSn(cleanCode);
                handleScan(cleanCode);
            }
            return;
        }

        scanTimer.current = setTimeout(() => {
            const cleanCode = text.trim();
            if (cleanCode.length > 0) {
                handleScan(cleanCode);
            }
        }, 500);
    };

    const handleScan = async (manualCode?: string) => {
        const codeToProcess = typeof manualCode === "string" ? manualCode : sn;
        if (!codeToProcess.trim()) return;

        clearTimeout(scanTimer.current);
        const inputSn = codeToProcess.toUpperCase().trim();
        setSn("");
        setLoading(true);

        try {
            const typeRes = await fetch(`${BASE_URL}/api/BarcodeType`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({ 
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode, scanCode: inputSn }),
            });
            const typeResult = await typeRes.json();

            let scanType = "";
            if (typeResult.message === "success" && typeResult.data && typeResult.data.length > 0) {
                scanType = typeResult.data[0].scanType;
            }

            if (scanType === "") { scanType = "pallet"; }

            let palletCode = "";
            if (scanType === "box" || scanType === "sn") {
                const palletRes = await fetch(`${BASE_URL}/api/GetWarePallet`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                    body: JSON.stringify({
                        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                        factoryCode: gs_factoryCode, scanType: scanType, scanCode: inputSn }),
                });

                if (palletRes.status === 401) {
                    Alert.alert("Unauthorized", "Token expired or invalid.");
                    return;
                }

                if (palletRes.status === 403) {
                    Alert.alert("Access Denied", "You do not have permission.");
                    return;
                }

                const palletResult = await palletRes.json();
                if (palletResult.message === "success" && palletResult.data && palletResult.data.length > 0) {
                    palletCode = palletResult.data[0].palletCode;
                } else {
                    throw new Error("Could not find associated pallet for this barcode.");
                }
            } else {
                palletCode = inputSn;
            }

            setCurrentPallet(palletCode);
            await fetchPalletDetails(palletCode);
        } catch (err: any) {
            Alert.alert("Error", err.message);
            setLoading(false);
        } finally {
            snInputRef.current?.focus();
        }
    };

    const fetchPalletDetails = async (palletCode: string) => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/DeliveryPalletSNConfirmBox`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    FactoryCode: gs_factoryCode,
                    FromWareHouseCode: gs_wareCode,
                    BarCode: palletCode,
                    ScanType: "pallet",
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
            if (result.message === "success" && result.data && result.data.length > 0) {
                let total = 0;
                const mapped = result.data.map((item: any, index: number) => {
                    total += parseInt(item.qty || "0");
                    return {
                        id: index.toString(),
                        fxh: item.fxh,
                        palletCode: item.palletCode,
                        boxCode: item.boxCode,
                        qty: item.qty,
                        model: item.model,
                        color: item.color,
                        orderCode: item.orderCode,
                    };
                });
                setBoxList(mapped);
                setTotalQty(total);
            } else {
                setBoxList([]);
                setTotalQty(0);
                Alert.alert("Notice", "There is no product in the Pallet!");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item, index }: { item: PalletBoxItem; index: number }) => {
        const isSelected = selectedItem?.id === item.id;
        return (
            <TouchableOpacity
                style={[
                    styles.tableRow,
                    { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" },
                    isSelected && styles.selectedRow
                ]}
                onPress={() => setSelectedItem(item)}
            >
                <Text style={[styles.cell, { width: 50 }]}>{item.fxh}</Text>
                <Text style={[styles.cell, { width: 150 }]}>{item.palletCode}</Text>
                <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
                <Text style={[styles.cell, { width: 60 }]}>{item.qty}</Text>
                <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
                <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
                <Text style={[styles.cell, { width: 120 }]}>{item.orderCode}</Text>
            </TouchableOpacity>
        );
    };

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
                    <Text style={styles.headerTitle}>Pallet Search</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.statsCard}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Total Qty</Text>
                    <Text style={styles.statValue}>{totalQty}</Text>
                </View>
            </View>

            <View style={styles.inputContainer}>
                <TextInput
                    ref={snInputRef}
                    style={styles.input}
                    value={sn}
                    onChangeText={handleBarcodeChange}
                    placeholder="Pallet/Box"
                    placeholderTextColor="#334155"
                    //onSubmitEditing={() => handleScan()}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    showSoftInputOnFocus={showKeyboard}
                    blurOnSubmit={false}
                    onBlur={ensureFocus}
                />
            </View>

            <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, { width: 50 }]}>No</Text>
                            <Text style={[styles.headerCell, { width: 150 }]}>Pallet Code</Text>
                            <Text style={[styles.headerCell, { width: 150 }]}>Box Code</Text>
                            <Text style={[styles.headerCell, { width: 60 }]}>Qty</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                            <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>Order</Text>
                        </View>

                        {loading && boxList.length === 0 ? (
                            <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                        ) : (
                            <FlatList
                                data={boxList}
                                renderItem={renderItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                scrollEnabled={true}
                                ListEmptyComponent={
                                    !loading ? (
                                        <View style={styles.emptyState}>
                                            <Text style={styles.emptyStateText}>No data to display. Scan a barcode to start.</Text>
                                        </View>
                                    ) : null
                                }
                            />
                        )}
                    </View>
                </ScrollView>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.btnPrimary, !selectedItem && styles.btnDisabled]}
                    onPress={() => {
                        if (selectedItem) {
                            navigation.navigate("PalletSNDetails", {
                                palletCode: selectedItem.palletCode,
                                boxCode: selectedItem.boxCode
                            });
                        } else {
                            Alert.alert("Notice", "Please select a box first.");
                        }
                    }}
                    disabled={!selectedItem}
                >
                    <Text style={styles.btnTextPrimary}>Barcode Details</Text>
                </TouchableOpacity>
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
    statsCard: { padding: 12, flexDirection: 'row', gap: 10, height: 65 },
    statBox: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#0052cc",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0"
    },
    statLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    inputContainer: { paddingHorizontal: 16, marginBottom: 8 },
    label: { fontSize: 10, fontWeight: "700", color: "#64748B", marginBottom: 4, textTransform: "uppercase" },
    input: { backgroundColor: "#e2f0eeff", height: 40, borderRadius: 10, paddingHorizontal: 12, fontSize: 13, color: "#1E293B", fontWeight: "600", borderWidth: 1, borderColor: "#0052cc" },
    tableCard: { flex: 1, backgroundColor: "#FFF", marginHorizontal: 16, borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: -4 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    selectedRow: { backgroundColor: "#ffc3c3ff" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    cellMain: { fontSize: 11, color: "#1E293B", fontWeight: "700", textAlign: "center" },
    cellSub: { fontSize: 10, color: "#64748B", textAlign: "center" },
    emptyState: { marginTop: 40, alignItems: "center" },
    emptyStateText: { color: "#94A3B8", fontSize: 14, fontWeight: "500" },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', marginBottom: -4 },
    actionBtn: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnPrimary: { backgroundColor: '#0052cc' },
    btnDisabled: { backgroundColor: '#004bccff' },
    btnTextPrimary: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
