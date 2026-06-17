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
    FlatList,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobal } from "../../GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function Assembly({ navigation }: any) {
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName, gs_wareCode, gs_userCode
        , operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
    } = global;
    const BASE_URL = gsURL;

    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [creationType, setCreationType] = useState<"pallet" | "box" | "">("");
    const [scanBarcode, setScanBarcode] = useState("");
    const [scanType, setScanType] = useState<"pallet" | "box" | "">("");
    const [scanName, setScanName] = useState("");
    const [itemList, setItemList] = useState<any[]>([]);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
    const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const barcodeRef = useRef("");
    const inputRef = useRef<TextInput>(null);
    const [showKeyboard, setShowKeyboard] = useState(false);

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            if (t) setToken(t);
        };
        loadToken();

        const modelSub = DeviceEventEmitter.addListener("ModelSelected", (data) => {
            if (creationType && data.model) {
                createNewCode(creationType as any, data.model);
            }
        });

        setTimeout(() => inputRef.current?.focus(), 500);

        return () => {
            modelSub.remove();
            if (scanTimer.current) clearTimeout(scanTimer.current);
        };
    }, [creationType, token]);





    const handleScan = async (code?: string) => {
        // High-speed PDA support: Prioritize passed code, then current ref, then state
        const SN = (code || barcodeRef.current || scanBarcode).toUpperCase().trim();

        if (!SN) return;

        // Clear everything immediately to prevent double-scans
        barcodeRef.current = "";
        setScanBarcode("");
        if (scanTimer.current) {
            clearTimeout(scanTimer.current);
            scanTimer.current = null;
        }

        setLoading(true);
        try {
            // getType(SN) logic
            const response = await fetch(`${BASE_URL}/api/BarcodeType`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode, barcode: SN
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
            if (result.message === "success" && result.data && result.data) {
                let scanTypeResult = result.data.scanType;
                //delete it after
                if (scanTypeResult === "") { scanTypeResult = 'pallet' }

                setScanType(scanTypeResult);
                setScanName(SN);

                // dataShow(SN) calls either palleNO or boxNO
                fetchData(scanTypeResult, SN);
                setScanBarcode("");
            } else {
                Alert.alert("Error", "Data handling exceptions, please check!");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleTextChange = (text: string) => {
        barcodeRef.current = text;
        setScanBarcode(text);

        if (scanTimer.current) {
            clearTimeout(scanTimer.current);
        }

        // PDA terminators (CR/LF)
        if (text.includes('\n') || text.includes('\r')) {
            handleScan(text);
            return;
        }

        // Auto-scan after pause
        if (text.trim().length > 5) {
            scanTimer.current = setTimeout(() => {
                if (barcodeRef.current === text) { // Only if text hasn't changed
                    handleScan(text);
                }
            }, 1000);
        }
    };

    const fetchData = async (type: string, code: string) => {
        const endpoint = type === "pallet"
            ? `/api/PalletNO/${gs_factoryCode}/${gs_wareCode}/${code}`
            : `/api/BoxNO/${gs_factoryCode}/${gs_wareCode}/${code}`;

        try {
            const response = await fetch(`${BASE_URL}${endpoint}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                }
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
            console.log("assempbly result", result)
            if (result.message === "success" && result.data) {
                setItemList(result.data);
                setSelectedItemIndex(null);
            } else {
                setItemList([]);
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        }
    };

    const handlePack = async () => {
        if (selectedItemIndex === null || !itemList[selectedItemIndex]) {
            Alert.alert("Error", "No data can be processed!");
            return;
        }

        const selectedItem = itemList[selectedItemIndex];
        const endpoint = scanType === "pallet" ? "/api/ZuPallet" : "/api/ZuBox";

        let body: any = {
            operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
            factoryCode: gs_factoryCode,
            wareHouseCode: gs_wareCode,
        };


        if (scanType === "pallet") {
            body = {
                ...body,
                palletCodeNew: scanName,
                boxCode: selectedItem.boxCode,
            };
        } else {
            body = {
                ...body,
                boxCodeNew: scanName,
                SN: selectedItem.sn || selectedItem.SN,
            };
        }

        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}${endpoint}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
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
                // Handle different response structures if necessary, but follow C# isok == "1"
                const resData = Array.isArray(result.data) ? result.data[0] : result.data;
                if (resData.isok == "1") {
                    // Normal: refresh data
                    await fetchData(scanType, scanName);
                } else {
                    Alert.alert("Error", resData.retstr || "Packing failed.");
                }
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    const createNewCode = async (type: "pallet" | "box", model: string) => {
        const endpoint = type === "pallet" ? "/api/PalletBox/GetPalletCode" : "/api/BoxCode";
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    model, createUser: gs_userCode
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
            if (result.message === "success" && result.data) {
                // The API might return a raw string or an object like { palletCode: "..." }
                let newCode = result.data;
                if (typeof newCode === 'object' && newCode !== null) {
                    newCode = newCode.palletCode || newCode.boxCode || newCode.code || Object.values(newCode)[0];
                }

                const finalCode = String(newCode);
                setScanBarcode(finalCode);
                setScanType(type);
                setScanName(finalCode);
                fetchData(type, finalCode);
                setTimeout(() => inputRef.current?.focus(), 500);
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
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
                    <Text style={styles.headerTitle}>Assembly </Text>
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
                            //onSubmitEditing={() => handleScan()}
                            blurOnSubmit={false}
                            placeholderTextColor="#334155"
                            showSoftInputOnFocus={showKeyboard}
                        />
                    </View>
                </View>

                <View style={styles.summaryContainer}>

                    <View style={[styles.infoLine, { marginTop: 6 }]}>
                        <Text style={styles.infoLabel}>{scanType === 'pallet' ? 'Pallet Code' : 'Box Code'}</Text>
                        <Text style={styles.infoValue}>{typeof scanName === 'string' ? scanName : JSON.stringify(scanName)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <View style={[styles.infoLine, { flex: 0.49, marginBottom: 0 }]}>
                            <Text style={styles.infoLabel}>Type</Text>
                            <Text style={styles.infoValue}>{scanType === 'pallet' ? 'Pallet' : 'Box'}</Text>
                        </View>
                        <View style={[styles.infoLine, { flex: 0.49, marginBottom: 0 }]}>
                            <Text style={styles.infoLabel}>Qty</Text>
                            <Text style={styles.infoValue}>{totalQty}</Text>
                        </View>
                    </View>
                </View>


                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 150 }]}>{scanType === "box" ? "SN" : "Box Code"}</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>Model</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Color</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>Qty</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                {loading ? (
                                    <View style={{ flex: 1, width: 500, justifyContent: 'center' }}>
                                        <ActivityIndicator size="large" color="#0052cc" />
                                    </View>
                                ) : (
                                    <FlatList
                                        data={itemList}
                                        keyExtractor={(item, index) => index.toString()}
                                        renderItem={({ item, index }) => (
                                            <TouchableOpacity
                                                style={[
                                                    styles.tableRow,
                                                    { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" },
                                                    selectedItemIndex === index && styles.selectedRow
                                                ]}
                                                onPress={() => setSelectedItemIndex(index)}
                                            >
                                                <Text style={[styles.cell, { width: 150 }]}>{scanType === "box" ? (item.SN || item.sn) : item.boxCode}</Text>
                                                <Text style={[styles.cell, { width: 130 }]}>{item.model}</Text>
                                                <Text style={[styles.cell, { width: 120 }]}>{item.color}</Text>
                                                <Text style={[styles.cell, { width: 100 }]}>{item.qty}</Text>
                                            </TouchableOpacity>
                                        )}
                                        ListEmptyComponent={
                                            <Text style={[styles.emptyText, { width: 500 }]}>Scan a code to view options</Text>
                                        }
                                    />
                                )}
                            </View>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footer}>
                    <View style={[styles.actionsRow, { marginBottom: 10, marginTop: 0 }]}>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
                            onPress={() => {
                                setCreationType("pallet");
                                navigation.navigate("ModelSelect");
                            }}
                        >
                            <Text style={styles.actionBtnText}>Create Pallet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#0891B2' }]}
                            onPress={() => {
                                setCreationType("box");
                                navigation.navigate("ModelSelect");
                            }}
                        >
                            <Text style={styles.actionBtnText}>Create Box</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        style={[styles.packBtn, (!scanName || selectedItemIndex === null) && styles.disabledBtn]}
                        onPress={handlePack}
                        disabled={!scanName || selectedItemIndex === null || loading}
                    >
                        <Text style={styles.packBtnText}>Submit</Text>
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
    scanIcon: { width: 18, height: 18, tintColor: '#0052cc' },
    scanBtn: { padding: 4 },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    actionBtn: { flex: 0.48, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    actionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
    summaryContainer: { marginBottom: 8 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
    infoLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: '#0052cc',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 6,
        alignItems: 'center'
    },
    infoLabel: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
    infoValue: { fontSize: 13, fontWeight: '900', color: '#F59E0B' },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 8 },
    headerCell: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600", paddingHorizontal: 8 },
    selectedRow: { backgroundColor: '#ffc3c3ff' },
    emptyText: { textAlign: "center", padding: 20, color: "#94A3B8", fontStyle: "italic", width: 400 },
    footer: { marginTop: 8 },
    packBtn: { backgroundColor: "#0052cc", padding: 12, borderRadius: 10, alignItems: "center", height: 40 },
    packBtnText: { color: "#FFF", fontWeight: "900", fontSize: 12 },
    disabledBtn: { backgroundColor: "#0052cc" },
});
