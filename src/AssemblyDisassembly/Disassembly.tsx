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
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobal } from "../../GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function Disassembly({ navigation }: any) {
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName, gs_wareCode,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
    } = global;
    const BASE_URL = gsURL;

    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [scanBarcode, setScanBarcode] = useState("");
    const [scanType, setScanType] = useState<"pallet" | "box" | "">("");
    const [scanName, setScanName] = useState("");
    const [itemList, setItemList] = useState<any[]>([]);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
    const [removalType, setRemovalType] = useState<"all" | "partial">("partial");
    const [showKeyboard, setShowKeyboard] = useState(false);

    const barcodeRef = useRef("");
    const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            if (t) setToken(t);
        };
        loadToken();
        setTimeout(() => inputRef.current?.focus(), 500);

        return () => {
            if (scanTimer.current) clearTimeout(scanTimer.current);
        };
    }, []);

    const fetchScanType = async (barcode: string) => {
        try {
            const response = await fetch(`${BASE_URL}/api/BarcodeType`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode, barcode
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
            console.log("scantype  ", result)
            if (result.message === "success" && result.data) {
                const data = Array.isArray(result.data) ? result.data[0] : result.data;
                return data.scanType || "";
            }
            return "";
        } catch (err) {
            return "";
        }
    };

    const handleScan = async (code?: string) => {
        const SN = (code || barcodeRef.current || scanBarcode).toUpperCase().trim();
        if (!SN) return;

        barcodeRef.current = "";
        setScanBarcode("");
        if (scanTimer.current) {
            clearTimeout(scanTimer.current);
            scanTimer.current = null;
        }

        setLoading(true);
        try {
            let type = await fetchScanType(SN);
            //delete it after
            if (type === "") { type = 'pallet' };
            if (!type || (type !== "pallet" && type !== "box"))
                if (!type || (type !== "pallet" && type !== "box")) {
                    Alert.alert("Error", "Data handling exceptions, please check!");
                    return;
                }

            setScanType(type);
            setScanName(SN);
            await fetchData(type, SN);
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const fetchData = async (type: string, code: string) => {
        let endpoint = "";

        if (type === "pallet") {
            endpoint = `/api/BoxByPallet/${gs_factoryCode}/${gs_wareCode}/${code}`;
        } else {
            endpoint = `/api/SNByBox/${gs_factoryCode}/${gs_wareCode}/${code}`;
        }

        try {
            const response = await fetch(`${BASE_URL}${endpoint}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                },
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

            if (result.message === "success" && result.data) {
                setItemList(result.data);
                setSelectedItemIndex(null);
            } else {
                setItemList([]);
                Alert.alert("No Data", "This " + type + " has no items.");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        }
    };

    const handleTextChange = (text: string) => {
        barcodeRef.current = text;
        setScanBarcode(text);

        if (scanTimer.current) {
            clearTimeout(scanTimer.current);
        }

        if (text.includes('\n') || text.includes('\r')) {
            handleScan(text);
            return;
        }

        if (text.trim().length > 5) {
            scanTimer.current = setTimeout(() => {
                if (barcodeRef.current === text) {
                    handleScan(text);
                }
            }, 1000);
        }
    };



    const handleRemove = async () => {
        const isAll = removalType === "all";

        if (!isAll && selectedItemIndex === null) {
            Alert.alert("Error", "Please select the data you need to process!");
            return;
        }

        if (itemList.length === 0) {
            Alert.alert("Error", "No data can be processed!");
            return;
        }

        Alert.alert(
            "Warning",
            "Are you sure Remove!",
            [
                {
                    text: "No",
                    style: "cancel"
                },
                {
                    text: "Yes",
                    style: "destructive",
                    onPress: async () => {
                        const selectedItem = selectedItemIndex !== null ? itemList[selectedItemIndex] : null;
                        let url = `${BASE_URL}/api`;

                        if (scanType === "pallet") {
                            if (isAll) {
                                url += `/ChaiPalletAll?factoryCode=${gs_factoryCode}&wareHouseCode=${gs_wareCode}&palletCode=${scanName}`;
                            } else {
                                url += `/ChaiPallet/single?factoryCode=${gs_factoryCode}&wareHouseCode=${gs_wareCode}&palletCode=${scanName}&boxCode=${selectedItem?.boxCode}`;
                            }
                        } else {
                            if (isAll) {
                                url += `/ChaiBoxAll?factoryCode=${gs_factoryCode}&wareHouseCode=${gs_wareCode}&boxCode=${scanName}`;
                            } else {
                                url += `/ChaiBox?factoryCode=${gs_factoryCode}&wareHouseCode=${gs_wareCode}&boxCode=${scanName}&SN=${selectedItem?.sn || selectedItem?.SN}`;
                            }
                        }

                        setLoading(true);
                        try {
                            const response = await fetch(url, {
                                method: "POST",
                                headers: {
                                    Authorization: `Bearer ${token}`
                                },
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

                            if (result.message === "success") {
                                await fetchData(scanType, scanName);
                            } else {
                                Alert.alert("Error", result.data || result.retstr || "Removal failed.");
                            }
                        } catch (err: any) {
                            Alert.alert("Error", err.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const totalQty = itemList.reduce((acc, curr) => acc + (parseInt(curr.qty) || 0), 0);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                        <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Disassembly </Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.inputSection}>
                    <View style={styles.scanInputContainer}>
                        <TextInput
                            ref={inputRef}
                            style={styles.scanInput}
                            placeholder="BarCode..."
                            value={scanBarcode}
                            onChangeText={handleTextChange}
                            onSubmitEditing={() => handleScan()}
                            blurOnSubmit={false}
                            placeholderTextColor="#1E293B"
                            showSoftInputOnFocus={showKeyboard}
                        />
                    </View>
                </View>

                <View style={styles.summaryRow}>
                    <View style={[styles.summaryBox, { backgroundColor: '#0052cc' }]}>
                        <Text style={styles.summaryLabel}>{scanType === 'pallet' ? 'Pallet' : scanType === 'box' ? 'Box' : 'Box/Pallet'}</Text>
                        <Text style={styles.summaryValue}>{scanName || '-'}</Text>
                    </View>
                    <View style={[styles.summaryBox, { backgroundColor: '#0052cc' }]}>
                        <Text style={styles.summaryLabel}>Type</Text>
                        <Text style={styles.summaryValue}>{scanType ? (scanType === 'pallet' ? 'Pallet' : 'Box') : '-'}</Text>
                    </View>
                </View>

                <View style={styles.removalTypeSection}>
                    <TouchableOpacity
                        style={styles.radioOption}
                        onPress={() => setRemovalType("partial")}
                    >
                        <View style={styles.radioOuter}>
                            {removalType === "partial" && <View style={styles.radioInner} />}
                        </View>
                        <Text style={styles.radioText}>Part</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.radioOption}
                        onPress={() => setRemovalType("all")}
                    >
                        <View style={styles.radioOuter}>
                            {removalType === "all" && <View style={styles.radioInner} />}
                        </View>
                        <Text style={styles.radioText}>All</Text>
                    </TouchableOpacity>
                    <View style={styles.totalQtyBox}>
                        <Text style={styles.totalQtyHeader}>Total QTY : {scanType === "box" ? itemList.length : totalQty}</Text>
                    </View>
                </View>

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                {scanType === "box" ? (
                                    <>
                                        <Text style={[styles.headerCell, { width: 140 }]}>Pallet Code</Text>
                                        <Text style={[styles.headerCell, { width: 150 }]}>SN</Text>
                                        <Text style={[styles.headerCell, { width: 130 }]}>Model</Text>
                                        <Text style={[styles.headerCell, { width: 160 }]}>Color</Text>
                                    </>
                                ) : (
                                    <>
                                        <Text style={[styles.headerCell, { width: 150 }]}>Box Code</Text>
                                        <Text style={[styles.headerCell, { width: 130 }]}>Model</Text>
                                        <Text style={[styles.headerCell, { width: 160 }]}>Color</Text>
                                        <Text style={[styles.headerCell, { width: 60 }]}>Qty</Text>
                                    </>
                                )}
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {loading ? (
                                    <View style={{ width: 500, marginTop: 40 }}>
                                        <ActivityIndicator size="large" color="#0052cc" />
                                    </View>
                                ) : itemList.length === 0 ? (
                                    <View style={{ width: 500, padding: 40 }}>
                                        <Text style={styles.emptyText}>No data can be processed!</Text>
                                    </View>
                                ) : (
                                    itemList.map((item, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.tableRow,
                                                { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" },
                                                selectedItemIndex === index && styles.selectedRow
                                            ]}
                                            onPress={() => setSelectedItemIndex(index)}
                                        >
                                            {scanType === "box" ? (
                                                <>
                                                    <Text style={[styles.cell, { width: 140 }]}>{item.palletCode}</Text>
                                                    <Text style={[styles.cell, { width: 150 }]}>{item.sn || item.SN}</Text>
                                                    <Text style={[styles.cell, { width: 130 }]}>{item.model}</Text>
                                                    <Text style={[styles.cell, { width: 160 }]}>{item.color}</Text>
                                                </>
                                            ) : (
                                                <>
                                                    <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
                                                    <Text style={[styles.cell, { width: 130 }]}>{item.model}</Text>
                                                    <Text style={[styles.cell, { width: 160 }]}>{item.color}</Text>
                                                    <Text style={[styles.cell, { width: 60 }]}>{item.qty}</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.removeBtn, !scanName && styles.disabledBtn]}
                        onPress={handleRemove}
                        disabled={!scanName || loading}
                    >
                        <Text style={styles.removeBtnText}>Remove</Text>
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
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    summaryBox: { flex: 0.49, padding: 8, borderRadius: 8, alignItems: 'center' },
    summaryLabel: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', textTransform: 'uppercase', opacity: 0.8 },
    summaryValue: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
    removalTypeSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: '#FFF', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    radioOption: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
    radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#0052cc', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0052cc' },
    radioText: { fontSize: 13, fontWeight: '700', color: '#334155' },
    totalQtyBox: { flex: 1, alignItems: 'flex-end' },
    totalQtyHeader: { fontSize: 13, fontWeight: '900', color: '#0052cc' },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 8 },
    headerCell: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600", paddingHorizontal: 4 },
    selectedRow: { backgroundColor: '#ffc3c3ff' },
    emptyText: { textAlign: "center", color: "#94A3B8", fontStyle: "italic" },
    footer: { marginTop: 8 },
    removeBtn: { backgroundColor: "#EF4444", padding: 12, borderRadius: 10, alignItems: "center", height: 44, elevation: 2 },
    removeBtnText: { color: "#FFF", fontWeight: "900", fontSize: 14 },
    disabledBtn: { backgroundColor: "#EF4444" },
});
