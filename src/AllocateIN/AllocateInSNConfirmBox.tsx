import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ScrollView,
    ActivityIndicator,
    StatusBar,
    Alert,
    Image,
    Dimensions,
    DeviceEventEmitter,
} from "react-native";

import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PalletDetail {
    id: string;
    fxh: string;
    boxCode: string;
    qty: string;
    model: string;
    color: string;
    orderCode: string;
    palletCode: string;
}

export default function AllocateInSNConfirmBox({ navigation, route }: any) {
    const { allocateCode, barCode, scanType, onConfirm } = route.params || {};
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName,operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<PalletDetail[]>([]);
    const [palletCode, setPalletCode] = useState("");
    const [totalQty, setTotalQty] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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
            const response = await fetch(`${BASE_URL}/api/AllocateInPalletSNConfirmBox`, {
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
            console.log("resultat de csnbox ", result);
            if (result.message === 'success' && result.data && result.data.length > 0) {
                setPalletCode(result.data[0].palletCode || "");
                let sum = 0;
                const mapped = result.data.map((item: any, index: number) => {
                    sum += parseInt(item.qty || "0");
                    return {
                        id: index.toString(),
                        fxh: item.fxh,
                        boxCode: item.boxCode,
                        qty: item.qty,
                        model: item.model,
                        color: item.color,
                        orderCode: item.orderCode,
                        palletCode: item.palletCode,
                    };
                });
                setDetails(mapped);
                setTotalQty(sum);
            } else {
                Alert.alert("Error", "There is no product in the Pallet!");
                navigation.goBack();
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    }, [allocateCode, barCode, scanType, gs_factoryCode, BASE_URL, token, navigation]);


    useEffect(() => {
        if (token) {
            fetchDetails();
        }
    }, [fetchDetails, token]);



    const handleConfirm = () => {
        Alert.alert(
            "Confirmation",
            "Are you sure you want to confirm this operation?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Yes",
                    onPress: () => {
                        console.log("Emitting ALLOCATE_IN_SN_CONFIRM event with:", barCode, scanType);
                        DeviceEventEmitter.emit('ALLOCATE_IN_SN_CONFIRM', {
                            allocateCode,
                            barCode,
                            scanType
                        });
                        navigation.goBack();
                    }
                }
            ]
        );
    };

    const renderItem = ({ item, index }: { item: PalletDetail; index: number }) => {
        const isSelected = selectedIndex === index;
        return (
            <TouchableOpacity
                style={[
                    styles.row,
                    index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#BAE6FD" },
                    isSelected && styles.selectedRow
                ]}
                onPress={() => setSelectedIndex(index)}
            >
                <Text style={[styles.cell, { width: 60 }]}>{item.fxh}</Text>
                <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
                <Text style={[styles.cell, { width: 60 }]}>{item.qty}</Text>
                <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
                <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
                <Text style={[styles.cell, { width: 150 }]}>{item.orderCode}</Text>
            </TouchableOpacity>
        );
    };

    const handleBarcodeDetails = () => {
        if (selectedIndex !== null && details[selectedIndex]) {
            const item = details[selectedIndex];
            navigation.navigate("AllocateInSNConfirm", {
                allocateCode,
                palletCode: item.palletCode,
                boxCode: item.boxCode,
                SN: "",
                scanType,
                showConfirm: false
            });
        } else {
            Alert.alert("Notice", "Please select a row first");
        }
    };

    const handleReturn = () => {
        navigation.goBack();
    };

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
                    <Text style={styles.headerTitle}>AllocateIn Confirm</Text>
                </View>

                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.statsCard}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Pallet</Text>
                        <Text style={styles.statValue}>{palletCode || "-"}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Total Qty</Text>
                        <Text style={styles.statValue}>{totalQty}</Text>
                    </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, { width: 60 }]}>No</Text>
                            <Text style={[styles.headerCell, { width: 150 }]}>Box Code</Text>
                            <Text style={[styles.headerCell, { width: 60 }]}>Qty</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                            <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                            <Text style={[styles.headerCell, { width: 150 }]}>Order</Text>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 40 }} />
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

                <View style={styles.actions}>
                    <TouchableOpacity style={styles.detailButton} onPress={handleBarcodeDetails}>
                        <Text style={styles.detailButtonText}>Barcode Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                        <Text style={styles.confirmButtonText}>Confirm</Text>
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
    content: { flex: 1, padding: 16 },
    statsCard: { paddingBottom: 16, gap: 10 },
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
        borderColor: "#E2E8F0",
        marginBottom:-4
    },
    statLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10, borderRadius: 10, marginBottom: 8 },
    headerCell: { fontSize: 12, fontWeight: "900", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    row: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderColor: "0052cc", borderBottomColor: "#F1F5F9", borderRadius: 8, marginBottom: 4 },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    selectedRow: { backgroundColor: "#ffc3c3ff" },
    actions: { flexDirection: "row", gap: 12, marginTop: 16 },
    detailButton: { flex: 1, backgroundColor: "#BAE6FD", padding: 8, borderRadius: 12, alignItems: "center", },
    detailButtonText: { color: "#475569", fontWeight: "900", fontSize: 15 },

    confirmButton: { flex: 1, backgroundColor: "#2563eb", padding: 8, borderRadius: 12, alignItems: "center", elevation: 2 },
    confirmButtonText: { color: "#FFF", fontWeight: "900", fontSize: 15 },

});
