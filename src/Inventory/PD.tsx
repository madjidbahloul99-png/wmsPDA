import React, { useState, useEffect, useCallback, useRef } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    Alert,
    TextInput,
    ScrollView,
    Dimensions,
    Image,
    FlatList,
    Modal,
} from "react-native";
import { useGlobal } from "../../GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlashList } from "@shopify/flash-list";

const FList = FlashList as any;

const warehouseIcon = require("../../assets/logo/warehouse.png");

const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 360;
const scale = (size: number) => (width / 375) * size;

export type CustomInputRef = {
    focus: () => void;
};

interface CustomInputProps {
    label?: string;
    value?: any;
    placeholder?: string;
    isSelect?: boolean;
    isPassword?: boolean;
    onChangeText: (val: any) => void;
    options?: any[];
    inputRef?: any;
    onSubmitEditing?: (e: any) => void;
    showSoftInput?: boolean;
    onBlur?: () => void;
    icon?: any;
}

const CustomInput = React.forwardRef<CustomInputRef, CustomInputProps>(
    (
        {
            label,
            value,
            placeholder,
            isSelect = false,
            isPassword = false,
            onChangeText,
            options = [],
            inputRef,
            onSubmitEditing,
            showSoftInput = true,
            onBlur,
            icon,
        },
        ref
    ) => {
        const [showModal, setShowModal] = useState(false);
        const [isFocused, setIsFocused] = useState(false);

        const hiddenInputRef = useRef<TextInput>(null);

        React.useImperativeHandle(ref, () => ({
            focus: () => hiddenInputRef.current?.focus(),
        }));

        const handleSelect = (item: any) => {
            onChangeText(item);
            setShowModal(false);
        };

        return (
            <View style={styles.inputWrapper}>
                {label && <Text style={styles.label}>{label}</Text>}
                {isSelect ? (
                    <TouchableOpacity
                        style={[

                            styles.inputContainer, { borderColor: "#0052cc" },
                            isFocused ? styles.inputFocused : null,
                            isSelect && value ? { borderWidth: 0, borderBottomWidth: 1, backgroundColor: 'transparent', paddingHorizontal: 0, borderRadius: 0 } : null
                        ]}
                        onPress={() => setShowModal(true)}
                    >
                        {icon && <Image source={icon} style={styles.inputIcon} />}
                        <Text style={[
                            value ? styles.input : styles.placeholderText,
                            isSelect && value ? { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0 } : null,
                            { flex: 1 }
                        ]}>
                            {value || placeholder}
                        </Text>
                        <Text style={styles.chevronIcon}>▼</Text>
                    </TouchableOpacity>
                ) : (
                    <View
                        style={[styles.inputContainer, isFocused ? styles.inputFocused : null]}
                    >
                        {icon && <Image source={icon} style={styles.inputIcon} />}
                        <TextInput
                            ref={inputRef}
                            value={value}
                            onChangeText={onChangeText}
                            placeholder={placeholder}
                            placeholderTextColor="#94a3b8"
                            style={styles.input}
                            secureTextEntry={isPassword}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => {
                                setIsFocused(false);
                                if (onBlur) onBlur();
                            }}
                            onSubmitEditing={onSubmitEditing}
                            blurOnSubmit={false}
                            returnKeyType="next"
                            showSoftInputOnFocus={showSoftInput}
                        />
                    </View>
                )}

                {isSelect && (
                    <Modal transparent visible={showModal} animationType="fade">
                        <TouchableOpacity
                            style={styles.modalOverlay}
                            onPress={() => setShowModal(false)}
                        >
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Select {label}</Text>
                                <FlatList
                                    data={options}
                                    keyExtractor={(item: any, index: number) =>
                                        `${item.ClassCode ?? item.wareHouseCode ?? item.inventoryNo ?? item}_${index}`
                                    }
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.optionItem}
                                            onPress={() => handleSelect(item)}
                                        >
                                            <Text style={styles.optionText}>
                                                {item.ClassName ?? item.wareHouseName ?? item.inventoryNo ?? item}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        </TouchableOpacity>
                    </Modal>
                )}

                {isSelect && (
                    <TextInput
                        style={{ height: 0, width: 0, padding: 0, margin: 0 }}
                        ref={hiddenInputRef}
                    />
                )}
            </View>
        );
    }
);

interface ScannedItem {
    id: string;
    barcode: string;
    model: string;
    color: string;
    qty: string;
}

interface InventoryOrder {
    inventoryNo: string;
}

export default function PD({ navigation }: any) {
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_wareCode, gs_userCode, gs_userName,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
    } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState<InventoryOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState("");
    const [inventoryType, setInventoryType] = useState("");
    const [model, setModel] = useState("");
    const [status, setStatus] = useState("");
    const [barcode, setBarcode] = useState("");
    const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
    const [totalQty, setTotalQty] = useState(0);
    const [showConfirmBtn, setShowConfirmBtn] = useState(false);
    const [showKeyboard, setShowKeyboard] = useState(false);

    const barcodeInputRef = useRef<TextInput>(null);
    const orderRef = useRef<CustomInputRef>(null);

    const ensureFocus = () => {
        if (barcodeInputRef.current) {
            barcodeInputRef.current.focus();
        }
    };

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
            fetchOrders();
        }
    }, [token]);



    const fetchHistory = useCallback(async (orderNo: string) => {
        if (!orderNo) return;
        try {
            const url = `${BASE_URL}/api/InventoryHistory/${encodeURIComponent(gs_factoryCode)}/${encodeURIComponent(gs_wareCode)}/${encodeURIComponent(orderNo)}`;

            const response = await fetch(url, {
                method: "GET",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
            });

            if (response.status === 401) {
                Alert.alert("Unauthorized", "Token expired or invalid.");
                return;
            }

            if (response.status === 403) {
                Alert.alert("Access Denied", "You do not have permission.");
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.code === 500) {
                Alert.alert("Error", result.message);
                navigation.goBack();
                return;
            }
            if (result.message === "success" && result.data) {
                let total = 0;
                const mapped = result.data.map((item: any, index: number) => {
                    total += parseInt(item.qty || "0");
                    return {
                        id: index.toString(),
                        barcode: item.barcode,
                        model: item.model,
                        color: item.color,
                        qty: item.qty,
                    };
                });
                setScannedItems(mapped);
                setTotalQty(total);
            } else {
                setScannedItems([]);
                setTotalQty(0);
            }
        } catch (err: any) {
            console.error("History fetch error:", err);
            Alert.alert("Error", "Failed to fetch inventory history: " + err.message);
        }
    }, [BASE_URL, gs_factoryCode, gs_wareCode, token]);

    const fetchOrderDetails = useCallback(async (orderNo: string) => {
        if (!orderNo) return;
        setLoading(true);
        try {
            const url = `${BASE_URL}/api/Inventory/GetInventoryOrder?factoryCode=${encodeURIComponent(gs_factoryCode)}&warehouseCode=${encodeURIComponent(gs_wareCode)}&inventoryNo=${encodeURIComponent(orderNo)}`;

            const response = await fetch(url, {
                method: "GET",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
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
                barcodeInputRef.current?.focus();
                const order = result.data[0];
                setInventoryType(order.inventoryType || "");
                setModel(order.model || "");
                setStatus(order.inventoryflag || "");

                const flag = (order.inventoryflag || "").toLowerCase();
                setShowConfirmBtn(flag === "notstart" || flag === "start");
            } else {
                setInventoryType("");
                setModel("");
                setStatus("Finish");
                setShowConfirmBtn(false);
            }
            fetchHistory(orderNo);
        } catch (err: any) {
            Alert.alert("Error", "Failed to fetch order details: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [BASE_URL, gs_factoryCode, gs_wareCode, token, fetchHistory]);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                factoryCode: gs_factoryCode,
                warehouseCode: gs_wareCode,
                inventoryNo: "",
            }).toString();

            const response = await fetch(`${BASE_URL}/api/Inventory/GetInventoryOrder?${query}`, {
                method: "GET",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
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
            if (result.message === "success" && result.data) {
                setOrders(result.data);
            } else {
                setOrders([]);
            }
        } catch (err: any) {
            Alert.alert("Error", "Failed to fetch inventory orders: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [gs_factoryCode, gs_wareCode, BASE_URL, token]);







    const handleScan = async (text?: string) => {
        if (!selectedOrder) {
            Alert.alert("Notice", "Please select inventory NO. first.");
            return;
        }
        const code = (text || barcode).trim().toUpperCase();
        if (!code) return;

        setLoading(true);
        try {
            const typeRes = await fetch(`${BASE_URL}/api/BarcodeType`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode, scanCode: code
                }),
            });

            if (typeRes.status === 401) {
                Alert.alert("Unauthorized", "Token expired or invalid.");
                return;
            }

            if (typeRes.status === 403) {
                Alert.alert("Access Denied", "You do not have permission.");
                return;
            }
            const typeResult = await typeRes.json();
            if (typeResult.code === 500) {
                Alert.alert("Error", typeResult.message);
                navigation.goBack();
                return;
            }
             console.log("typeResult", typeResult);
            let scanType = "";
            if (typeResult.message === "success" && typeResult.data ) {
                scanType = typeResult.data.scanType;
            }
            console.log("scanType", scanType);
            if (scanType === "pallet" || scanType === "box" || scanType === "sn") {
                const scanRes = await fetch(`${BASE_URL}/api/InventoryScan/CheckAndWriteScan`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                    body: JSON.stringify({
                        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                        factoryCode: gs_factoryCode,
                        warehouseCode: gs_wareCode,
                        inventoryNo: selectedOrder,
                        inventoryType: inventoryType,
                        inventoryModel: model,
                        scanCode: code,
                        scanType: scanType || "pallet",
                        userCode: gs_userCode,
                    }),
                });

                if (scanRes.status === 401) {
                    Alert.alert("Unauthorized", "Token expired or invalid.");
                    return;
                }

                if (scanRes.status === 403) {
                    Alert.alert("Access Denied", "You do not have permission.");
                    return;
                }
                const scanResult = await scanRes.json();
                console.log("inventory", scanResult)
                if (scanResult.message === "success" && scanResult.data) {
                    const resultData = scanResult.data;

                    if (resultData.isok === "0") {
                        
                        Alert.alert("Error", resultData.retstr || "Scan failed");
                    } else {
                        Alert.alert("Success", "scan successfully.");
                        const addedQty = parseInt(resultData.qty || "0");

                        const newItem = {
                            id: Date.now().toString(),
                            barcode: resultData.barcode,
                            model: resultData.model,
                            color: resultData.color,
                            qty: resultData.qty,
                        };

                        setScannedItems(prev => [newItem, ...prev]);
                        setTotalQty(prev => prev + addedQty);
                    }
                } else {
                    Alert.alert("Error", "No data returned from scan.");
                }
            } else {
                Alert.alert("Error", `[${code}] is not a valid SN/Pallet/Box No.`);
            }
        } catch (err: any) {
            Alert.alert("Error", "Scan processing error: " + err.message);
        } finally {
            setLoading(false);
            setBarcode("");
            barcodeInputRef.current?.focus();
        }
    };

    const handleConfirm = () => {
        if (!selectedOrder) {
            Alert.alert("Notice", "Please select inventory NO. first.");
            return;
        }
        Alert.alert(
            "Confirm",
            "Are you sure All Pallet/Box/SN finish?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "OK",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const response = await fetch(`${BASE_URL}/api/InventoryConfirm`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                                body: JSON.stringify({
                                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                                    factoryCode: gs_factoryCode,
                                    warehouseCode: gs_wareCode,
                                    inventoryNo: selectedOrder,
                                    inventoryType: inventoryType,
                                    inventoryModel: model,
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
                            if (result.message === "success") {
                                Alert.alert("Success", "Inventory confirmed successfully.");
                                setShowConfirmBtn(false);
                                setStatus("Finish");
                            } else {
                                Alert.alert("Error", result.data?.[0]?.retstr || "Confirmation failed");
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

    const renderItem = ({ item, index }: { item: ScannedItem; index: number }) => (
        <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" }]}>
            <Text style={[styles.cell, { width: 180 }]}>{item.barcode}</Text>
            <Text style={[styles.cell, { width: 140 }]}>{item.model}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.color}</Text>
            <Text style={[styles.cell, { width: 80 }]}>{item.qty}</Text>
        </View>
    );

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
                    <Text style={styles.headerTitle}>Inventory Management</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.statsCard}>
                <View style={[styles.statBox, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <Text style={styles.statLabel}>Total</Text>
                    <Text style={styles.statValue}>{totalQty}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.formCard}>
                    <View style={styles.inputGroup}>
                        <CustomInput
                            ref={orderRef}
                            placeholder={orders.length > 0 ? "Inventory NO" : "there is no items"}
                            value={selectedOrder}
                            onChangeText={(val: any) => {
                                setSelectedOrder(val.inventoryNo);
                                fetchOrderDetails(val.inventoryNo);
                            }}
                            isSelect
                            options={orders}
                            onBlur={ensureFocus}
                        />
                    </View>

                    <View style={styles.infoGrid}>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>Type</Text>
                            <Text style={styles.infoValue}>{inventoryType || "-"}</Text>
                        </View>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>Model</Text>
                            <Text style={styles.infoValue}>{model || "-"}</Text>
                        </View>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>Status</Text>
                            <Text style={[
                                styles.infoValue,
                                status.toLowerCase() === "finish" ? { color: "#10B981" } : { color: "#F59E0B" }
                            ]}>
                                {status || "-"}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <TextInput
                            ref={barcodeInputRef}
                            style={styles.input}
                            value={barcode}
                            onChangeText={setBarcode}
                            placeholder=" Barcode"
                            onSubmitEditing={(e) => handleScan(e.nativeEvent.text)}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            showSoftInputOnFocus={showKeyboard}
                            blurOnSubmit={false}
                            onBlur={ensureFocus}
                        />
                    </View>
                </View>

                <View style={styles.tableContainer}>
                    <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
                        <View style={{ width: 520 }}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 180 }]}>Barcode</Text>
                                <Text style={[styles.headerCell, { width: 140 }]}>Model</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Color</Text>
                                <Text style={[styles.headerCell, { width: 80 }]}>Qty</Text>
                            </View>

                            {loading && scannedItems.length === 0 ? (
                                <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                            ) : (
                                <FList
                                    data={scannedItems}
                                    renderItem={renderItem}
                                    keyExtractor={(item: ScannedItem, index: number) => `${item.id}_${index}`}
                                    contentContainerStyle={{ paddingBottom: 10 }}
                                    estimatedItemSize={40}
                                    ListEmptyComponent={
                                        <View style={{ padding: 20, alignItems: 'center' }}>
                                            <Text style={{ color: '#94A3B8', fontStyle: 'italic' }}>No items scanned yet</Text>
                                        </View>
                                    }
                                />
                            )}
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footer}>
                    <View style={styles.buttonRow}>
                        {showConfirmBtn && (
                            <TouchableOpacity style={[styles.actionBtn, styles.btnPrimary]} onPress={handleConfirm}>
                                <Text style={styles.btnTextPrimary}>All Finish</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

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
    statsCard: { padding: 8 },
    statBox: {
        backgroundColor: "#0052cc",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0"
    },
    statLabel: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
    content: { flex: 1 },
    formCard: {
        backgroundColor: "#FFF",
        padding: 8,
        borderRadius: 12,
        marginHorizontal: 8,
        marginBottom: 2,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0"
    },
    inputGroup: { marginBottom: 4 },
    label: { fontSize: 10, fontWeight: "700", color: "#64748B", marginBottom: 2, textTransform: "uppercase" },
    infoGrid: { flexDirection: "row", gap: 2, marginBottom: 2 },
    infoBox: { flex: 1, backgroundColor: "#F8FAFC", padding: 4, borderRadius: 8, borderWidth: 1, borderColor: "#F1F5F9" },
    infoLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "700", textTransform: "uppercase" },
    infoValue: { fontSize: 11, color: "#1E293B", fontWeight: "700", marginTop: 0 },
    input: {
        backgroundColor: "#F1F5F9", height: 32, borderRadius: 8, paddingHorizontal: 10, fontSize: 12, color: "#1E293B", fontWeight: "600",
        borderWidth: 1, borderColor: "#0052cc", paddingVertical: 0, textAlignVertical: 'center'
    },
    tableContainer: { flex: 1, backgroundColor: "#FFF", marginHorizontal: 8, borderRadius: 12, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 2 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 8 },
    headerCell: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    cellMain: { fontSize: 11, color: "#1E293B", fontWeight: "700", textAlign: "center" },
    cellSub: { fontSize: 10, color: "#64748B", textAlign: "center" },
    footer: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    buttonRow: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnPrimary: { backgroundColor: '#10B981' },
    btnSecondary: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    btnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '800' },
    btnTextSecondary: { color: '#475569', fontSize: 15, fontWeight: '700' },
    keyboardToggleText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#0052cc',
    },
    inputWrapper: {
        marginBottom: 4,

    },
    inputContainer: {
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#0052cc",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        backgroundColor: "#F1F5F9",
    },
    inputFocused: {
        borderColor: "#0052cc",
    },
    inputIcon: {
        width: 16,
        height: 16,
        marginRight: 8,
        tintColor: "#64748b",
    },
    placeholderText: {
        color: "#94a3b8",
        fontSize: 12,
    },
    chevronIcon: {
        fontSize: 10,
        color: "#94a3b8",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        backgroundColor: "#fff",
        width: width * 0.9,
        maxHeight: height * 0.6,
        borderRadius: 16,
        padding: width * 0.05,
    },
    modalTitle: {
        fontSize: 14,
        fontWeight: "800",
        marginBottom: 12,
        textAlign: "center",
    },
    optionItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#f1f5f9",
    },
    optionText: {
        fontSize: 13,
        textAlign: "center",
    },
});

