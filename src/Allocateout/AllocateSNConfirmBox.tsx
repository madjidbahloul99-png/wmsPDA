import React, { useState, useEffect, useMemo } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Alert,
    StatusBar,
    ActivityIndicator,
    ListRenderItem,
    Image,
    Dimensions,
    ScrollView,
    DeviceEventEmitter,

} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";


interface PalletDetail {
    id: string;
    fxh: string;
    boxCode: string;
    qty: number;
    model: string;
    color: string;
    orderCode: string;
    palletCode: string;
}

const BoxRow = React.memo(({
    item,
    index,
    isSelected,
    onPress
}: {
    item: PalletDetail;
    index: number;
    isSelected: boolean;
    onPress: (item: PalletDetail) => void;
}) => (
    <TouchableOpacity
        onPress={() => onPress(item)}
        style={[
            styles.row,
            index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#BAE6FD" },
            isSelected && { backgroundColor: "#ffc3c3ff" },
        ]}
        activeOpacity={0.7}
    >
        <Text style={[styles.cell, { width: 40 }]}>{item.fxh}</Text>
        <Text style={[styles.cell, { width: 100 }]}>{item.boxCode}</Text>
        <Text style={[styles.cell, { width: 50 }]}>{item.qty}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.orderCode}</Text>
    </TouchableOpacity>
));

export default function AllocateSNConfirmBox({ navigation, route }: any) {
    const { fromWareHouseCode, barCode, scanType } = route.params || {};
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName, gs_wareCode, operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");


    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<PalletDetail[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [palletCode, setPalletCode] = useState("");

    const selectedItem = useMemo(() =>
        items.find(i => i.id === selectedItemId) || null
        , [items, selectedItemId]);




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
            fetchPalletDetails();
        }
    }, [token]);



    const fetchPalletDetails = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/AllocatePalletSNConfirmBox`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode,
                    fromWareHouseCode,
                    barCode,
                    scanType
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

            if (result.code === 500) {
                Alert.alert("Error", result.message);
                navigation.goBack();
                return;
            }
            console.log("outresult", result);
            if (result.message === 'success' && result.data && result.data.length > 0) {
                const mappedData = result.data.map((row: any, index: number) => ({
                    id: index.toString(),
                    fxh: row.fxh,
                    boxCode: row.boxCode,
                    qty: parseInt(row.qty || "0", 10),
                    model: row.model,
                    color: row.color,
                    orderCode: row.orderCode,
                    palletCode: row.palletCode,
                }));
                setItems(mappedData);
                setPalletCode(result.data[0].palletCode || "");
            } else {
                setItems([]);
                setPalletCode("");
                Alert.alert("Error", "There is no product in the Pallet!");
                navigation.goBack();
            }
        } catch (error) {
            setItems([]);
            setPalletCode("");
            Alert.alert("Error", "Failed to load pallet details");
        } finally {
            setLoading(false);
        }
    };

    const totalQty = useMemo<number>(
        () => items.reduce((sum, i) => sum + i.qty, 0),
        [items]
    );

    const confirmBatch = (): void => {
        if (items.length >= 1) {
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
                            DeviceEventEmitter.emit(
                                "ON_ALLOCATE_CONFIRM",
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
            Alert.alert("Message", "No items to confirm.");
        }
    };

    const showBarcodeDetails = (): void => {
        if (!selectedItem) {
            Alert.alert("Message", "Please select a box first.");
            return;
        }

        navigation.navigate('AllocateSNConfirm', {
            fromWareHouseCode: gs_wareCode,
            palletCode: palletCode,
            boxCode: selectedItem.boxCode,
            SN: "",
            scanType,
            showConfirm: false
        });
    };

    const handleReturn = () => {
        navigation.goBack();
    };

    const handleSelectItem = React.useCallback((item: PalletDetail) => {
        setSelectedItemId(item.id);
    }, []);

    const renderItem: ListRenderItem<PalletDetail> = React.useCallback(({ item, index }) => (
        <BoxRow
            item={item}
            index={index}
            isSelected={selectedItemId === item.id}
            onPress={handleSelectItem}
        />
    ), [selectedItemId, handleSelectItem]);

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
                    <Text style={styles.headerTitle}>Allocate Confirm</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.card}>
                    <View style={{ marginBottom: 8 }}>
                        <View style={[styles.input, { backgroundColor: '#0052cc', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 5, marginBottom: 8 }]}>
                            <Text style={[styles.label, { marginBottom: 0, color: "#FFFFFF" }]}>PALLET</Text>
                            <Text style={{ fontSize: 13, color: "#FFFFFF", fontWeight: "700" }}>{palletCode}</Text>
                        </View>

                        <View style={[styles.input, { backgroundColor: '#0052cc', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 5 }]}>
                            <Text style={[styles.label, { marginBottom: 0, color: "#FFFFFF" }]}>TOTAL QTY</Text>
                            <Text style={{ fontSize: 13, color: "#FFFFFF", fontWeight: "700" }}>{totalQty}</Text>
                        </View>
                    </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View style={{ width: 530 }}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, { width: 40 }]}>No</Text>
                            <Text style={[styles.headerCell, { width: 100 }]}>Box Code</Text>
                            <Text style={[styles.headerCell, { width: 50 }]}>Qty</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                            <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>Order Code</Text>
                        </View>

                        <FlatList
                            data={items}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            extraData={selectedItemId}
                            contentContainerStyle={styles.listContent}
                            removeClippedSubviews={true}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            initialNumToRender={10}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    {loading ? <ActivityIndicator color="#2563eb" /> : <Text style={styles.emptyText}>Waiting for scans...</Text>}
                                </View>
                            }
                        />
                    </View>
                </ScrollView>
            </View>

            <View style={styles.footer}>
                <View style={styles.buttonRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.btnSecondary]}
                        onPress={showBarcodeDetails}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.btnTextSecondary}>Barcode Detail</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, styles.btnPrimary]}
                        onPress={confirmBatch}
                        activeOpacity={0.8}
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
    container: { flex: 1, backgroundColor: '#f8fafc' },
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
    content: { flex: 1, padding: 16 },
    card: {},
    label: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 4, textTransform: "uppercase" },
    input: { backgroundColor: "#0052cc", padding: 3, borderRadius: 10, fontSize: 12, color: "#FFFFFF", borderWidth: 1, borderColor: "#CBD5E1", height: 35 },
    palletInfo: { backgroundColor: "#F1F5F9", padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#CBD5E1", marginBottom: 10 },
    palletLabel: { color: "#64748B", fontSize: 10, textTransform: "uppercase", fontWeight: "700" },
    palletValue: { color: "#1E293B", fontSize: 15, fontWeight: "800", marginTop: 2 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center' },
    summaryLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '800' },
    summaryValue: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
    tableHeader: { flexDirection: 'row', backgroundColor: '#0052cc', paddingVertical: 10, borderRadius: 8, marginBottom: 4, marginTop: 8 },
    headerCell: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', textAlign: 'center' },
    listContent: { paddingBottom: 20, },
    row: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', borderRadius: 8, marginBottom: 4, alignItems: 'center' },
    cell: { fontSize: 11, color: '#334155', fontWeight: '600', textAlign: 'center' },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
    footer: { padding: 16, marginTop: -16 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnPrimary: { backgroundColor: '#2563eb' },
    btnSecondary: { backgroundColor: '#BAE6FD', borderWidth: 1, borderColor: '#e2e8f0' },
    btnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '800' },
    btnTextSecondary: { color: '#475569', fontSize: 15, fontWeight: '700' },
});
