import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    StatusBar,
    ActivityIndicator,
    Image,
    Dimensions,
    DeviceEventEmitter,
} from "react-native";
import { Picker } from '@react-native-picker/picker';
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as inWareHouseChinaClient from "./inWareHouseChinaClient";

interface InChinaBoxItem {
    id: string;
    boxCode: string;
    model: string;
    color: string;
    boxQty: string;
}

export default function InWareHouseChina({ navigation }: any) {
    const {
        gs_MESBaseURL,
        gs_wareCode,
        gs_wareType,
        gs_factoryCodeMES,
        gs_classCode,
        gs_groupCode,
        gs_workdate,
        gs_userCode,
        gs_userName,
    } = useGlobalStr();

    const [txtSN, setTxtSN] = useState("");
    const [txtPallet, setTxtPallet] = useState("");
    const [txtQty, setTxtQty] = useState("");
    const [orders, setOrders] = useState<any[]>([]);
    const [selectedOrder, setSelectedOrder] = useState("");
    const [items, setItems] = useState<InChinaBoxItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showKeyboard, setShowKeyboard] = useState(false);
    const [headerTitle, setHeaderTitle] = useState("");
    const [isInputEnabled, setIsInputEnabled] = useState(true);

    const txtSNRef = useRef<TextInput>(null);

    const ensureFocus = () => {
        if (isInputEnabled) {
            txtSNRef.current?.focus();
        }
    };

    useEffect(() => {
        setHeaderTitle(`In China ${gs_wareCode || ""}`);
        initPage();

        const confirmSub = DeviceEventEmitter.addListener("ON_IN_CHINA_CONFIRM_OK", (data: { palletCode: string; SN: string; scanType: string; orderCode: string }) => {
            if (data && data.palletCode) {
                processPalletInsert(data.palletCode, data.SN, data.scanType, data.orderCode);
            }
        });

        const focusSub = navigation.addListener("focus", () => {
            setTimeout(() => {
                if (isInputEnabled) {
                    txtSNRef.current?.focus();
                }
            }, 150);
        });

        return () => {
            confirmSub.remove();
            focusSub();
        };
    }, []);

    const initPage = async () => {
        if (gs_wareType !== "MainWarehouse") {
            pubfunction.ShowError("Only the main warehouse can be put in storage!");
            setIsInputEnabled(false);
            return;
        }

        setLoading(true);
        try {
            const isOk = await inWareHouseChinaClient.helloWorld(gs_MESBaseURL);
            if (!isOk) {
                pubfunction.ShowError("Connect error, Please change URL link!");
                setIsInputEnabled(false);
                setLoading(false);
                return;
            }

            await getOrder();

            setIsInputEnabled(true);
            setTimeout(() => {
                txtSNRef.current?.focus();
            }, 300);
        } catch (err: any) {
            pubfunction.ShowError("Connect error, Please change URL link!");
            setIsInputEnabled(false);
        } finally {
            setLoading(false);
        }
    };

    const getOrder = async () => {
        try {
            const res = await inWareHouseChinaClient.inBarcodeGetOrderChina(gs_MESBaseURL);
            if (res && res.success && res.list) {
                setOrders(res.list);
                if (res.list.length > 0) {
                    setSelectedOrder(res.list[0].orderCode);
                }
            }
        } catch (err: any) {
            console.error(err);
        }
    };

    const getQty = async (orderCode: string) => {
        if (!orderCode) return;
        try {
            const res = await inWareHouseChinaClient.inBarcodeGetOrderQtyChina(gs_MESBaseURL, orderCode);
            if (res && res.success && res.data && res.data.length > 0) {
                const row = res.data[0];
                const qty = row.qty;
                const qtyIn = row.qtyIn;
                setHeaderTitle(`${orderCode}  ${qtyIn}/${qty}`);

                if (qtyIn === qty) {
                    await getOrder();
                }
            }
        } catch (err: any) {
            console.error(err);
        }
    };

    const handleOrderChange = (itemValue: string) => {
        setSelectedOrder(itemValue);
        getQty(itemValue);
    };

    const handleSNSubmit = () => {
        const SN = txtSN.toUpperCase().trim();
        if (!selectedOrder) {
            pubfunction.ShowError("First choose Order!");
            return;
        }
        if (SN.length > 0) {
            palletDeal(SN, selectedOrder);
        }
    };

    const palletDeal = async (SN: string, orderCode: string) => {
        setLoading(true);
        let palletCode = "";
        let scanType = "";

        try {
            const res = await inWareHouseChinaClient.inBarcodeCheckChina(gs_MESBaseURL, gs_factoryCodeMES, SN, orderCode);
            if (res && res.success && res.data && res.data.length > 0) {
                const row = res.data[0];
                if (row.isok === "1") {
                    palletCode = row.palletCode;
                    scanType = row.scanType;
                    setTxtPallet(palletCode);
                } else {
                    pubfunction.ShowError(row.retstr);
                    setLoading(false);
                    return;
                }
            } else {
                pubfunction.ShowError("Data handling exceptions, please check!");
                setLoading(false);
                return;
            }

            setLoading(false);
            navigation.navigate("InWareHouseChinaSNConfirmBox", {
                f_palletCode: palletCode,
                f_SN: SN,
                f_scanType: scanType,
                f_orderCode: orderCode,
            });

            setTxtSN("");

        } catch (err: any) {
            console.error(err);
            pubfunction.ShowError(err.message || "Network Error");
            setLoading(false);
        }
    };

    const processPalletInsert = async (palletCode: string, SN: string, scanType: string, orderCode: string) => {
        setLoading(true);
        try {
            const res = await inWareHouseChinaClient.inPalletInsertChina(
                gs_MESBaseURL, gs_factoryCodeMES, gs_wareCode, scanType, palletCode, SN, gs_classCode, gs_groupCode, gs_workdate, gs_userCode, orderCode
            );

            if (res && res.success && res.data && res.data.length > 0) {
                const row = res.data[0];
                if (row.isok === "1") {
                    setTxtQty(row.totalQty || "");

                    if (res.list && res.list.length > 0) {
                        const mappedItems: InChinaBoxItem[] = res.list.map((r: any, i: number) => ({
                            id: String(i),
                            boxCode: r.scanBarcodeLarge || "",
                            model: r.model || "",
                            color: r.color || "",
                            boxQty: r.boxQty || "",
                        }));
                        setItems(mappedItems);
                    } else {
                        setItems([]);
                    }
                } else {
                    pubfunction.ShowError(row.retstr);
                }
            } else {
                pubfunction.ShowError("There is no product in the Pallet!");
            }

            await getQty(orderCode);
        } catch (err: any) {
            console.error(err);
            pubfunction.ShowError(err.message || "Network Error");
        } finally {
            setLoading(false);
            setTimeout(() => {
                txtSNRef.current?.focus();
            }, 150);
        }
    };

    const handleBtnSNmx = () => {
        if (!txtPallet) return;
        navigation.navigate("InWareHouseChinaSNBox", {
            f_palletCode: txtPallet
        });
    };

    const renderItem = ({ item, index }: { item: InChinaBoxItem; index: number }) => {
        return (
            <View
                style={[
                    styles.row,
                    { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }
                ]}
            >
                <Text style={[styles.cell, { flex: 2 }]}>{item.boxCode}</Text>
                <Text style={[styles.cell, { flex: 1.5 }]}>{item.model}</Text>
                <Text style={[styles.cell, { flex: 1 }]}>{item.color}</Text>
                <Text style={[styles.cell, { flex: 0.8 }]}>{item.boxQty}</Text>
            </View>
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
                    <Text style={styles.headerTitle}>{headerTitle}</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.card}>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={selectedOrder}
                            onValueChange={handleOrderChange}
                            style={styles.picker}
                            enabled={isInputEnabled}
                        >
                            {orders.map((o) => (
                                <Picker.Item key={o.orderCode} label={o.orderCode} value={o.orderCode} />
                            ))}
                        </Picker>
                    </View>

                    <View style={styles.inputGroup}>
                        <TextInput
                            ref={txtSNRef}
                            style={[styles.input, !isInputEnabled && styles.inputDisabled]}
                            value={txtSN}
                            onChangeText={setTxtSN}
                            onSubmitEditing={handleSNSubmit}
                            placeholder=" SCAN BARCODE"
                            placeholderTextColor="#64748B"
                            autoCapitalize="characters"
                            showSoftInputOnFocus={showKeyboard}
                            blurOnSubmit={false}
                            onBlur={ensureFocus}
                            selectTextOnFocus={true}
                            editable={isInputEnabled}
                        />
                    </View>
                </View>

                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Pallet</Text>
                        <Text style={styles.infoVal}>{txtPallet}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Qty</Text>
                        <Text style={styles.infoVal}>{txtQty}</Text>
                    </View>

                    <TouchableOpacity style={styles.btnAction} onPress={handleBtnSNmx}>
                        <Text style={styles.btnActionText}>Pallet/Box Detail</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.listCard}>
                    <View style={styles.listHeader}>
                        <Text style={[styles.headerCell, { flex: 2 }]}>BOX CODE</Text>
                        <Text style={[styles.headerCell, { flex: 1.5 }]}>MODEL</Text>
                        <Text style={[styles.headerCell, { flex: 1 }]}>COLOR</Text>
                        <Text style={[styles.headerCell, { flex: 0.8 }]}>QTY</Text>
                    </View>
                    <FlatList
                        data={items}
                        renderItem={renderItem}
                        keyExtractor={(item, index) => `${item.boxCode}-${index}`}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>No boxes found.</Text>
                        }
                    />
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.exitButtonText}>Exit</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#0052cc" />
                </View>
            )}
        </SafeAreaView>
    );
}

const { width } = Dimensions.get("window");
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
    headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
    content: { flex: 1, padding: 8 },
    card: {
        backgroundColor: "#FFF",
        borderRadius: 16,
        padding: 10,
        marginBottom: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#0052cc",
    },
    pickerContainer: {
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 10,
        marginBottom: 10,
        backgroundColor: "#F8FAFC",
    },
    picker: {
        height: 40,
    },
    inputGroup: { marginBottom: 4 },
    input: {
        backgroundColor: "#e2f0eeff",
        height: 40,
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 14,
        color: "#1E293B",
        fontWeight: "600",
        borderWidth: 1,
        borderColor: "#0052cc",
    },
    inputDisabled: {
        backgroundColor: "#F1F5F9",
        borderColor: "#CBD5E1",
        color: "#94A3B8"
    },
    infoCard: {
        backgroundColor: "#FFF",
        borderRadius: 16,
        padding: 10,
        borderWidth: 1,
        borderColor: "#0052cc",
        marginBottom: 8,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 4,
    },
    infoLabel: { fontSize: 12, fontWeight: "800", color: "#475569" },
    infoVal: { fontSize: 12, fontWeight: "900", color: "#1E293B" },
    btnAction: {
        backgroundColor: "#0052cc",
        padding: 10,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 8,
    },
    btnActionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
    listCard: {
        flex: 1,
        backgroundColor: "#FFF",
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#0052cc",
        marginBottom: 8,
    },
    listHeader: {
        flexDirection: "row",
        backgroundColor: "#0052cc",
        paddingVertical: 10,
        paddingHorizontal: 6,
    },
    headerCell: {
        fontSize: 11,
        fontWeight: "800",
        color: "#FFFFFF",
        textAlign: "center",
    },
    row: {
        flexDirection: "row",
        paddingVertical: 12,
        paddingHorizontal: 6,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
        alignItems: "center",
    },
    cell: {
        fontSize: 11,
        color: "#1E293B",
        textAlign: "center",
        fontWeight: "600",
    },
    emptyText: {
        textAlign: "center",
        padding: 40,
        color: "#94A3B8",
        fontStyle: "italic",
    },
    footer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 2 },
    exitButton: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#64748B' },
    exitButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
});
