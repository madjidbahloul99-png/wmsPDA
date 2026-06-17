import React, { useState, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Image,
    Dimensions,
    DeviceEventEmitter,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function DeliveryReturnSNConfirm({ navigation, route }: any) {
    const { palletCode, sType, currentSn, deliveryCode, systemDeliveryCode, tock, boxCode, showConfirm = true } = route.params;
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_wareCode, gs_userName,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(false);
    const [snData, setSnData] = useState<any[]>([]);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

    const totalQty = snData.length;

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            if (t) setToken(t);
        };
        loadToken();
    }, []);

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${BASE_URL}/api/DeliveryReturnPalletSNConfirm`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                    body: JSON.stringify({
                        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                        factoryCode: gs_factoryCode,
                        deliveryCode,
                        palletCode: palletCode || "",
                        boxCode: boxCode || "",
                        SN: currentSn || "",
                        scanType: sType
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
                console.log("confirmsn", result)
                if (result.message === "success" && result.data.length > 0) {
                    setSnData(result.data);
                } else {
                    Alert.alert("Error", "There is no product in the box!");
                    navigation.goBack();

                }
            } catch (err: any) {
                Alert.alert("Error", err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, palletCode, deliveryCode, currentSn]);

    const handleConfirm = () => {
        Alert.alert(
            "Confirm Return",
            "Are you sure you want to confirm this return?",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Yes",
                    onPress: () => {
                        DeviceEventEmitter.emit('ON_DELIVERY_RETURN_CONFIRM', { palletCode, sType, currentSn });
                        navigation.goBack();
                    }
                }
            ]
        );
    };

    const handleReturn = () => {
        if (showConfirm) {
            DeviceEventEmitter.emit('ON_DELIVERY_RETURN_CANCEL');
        }
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={handleReturn} activeOpacity={0.7}>
                        <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{showConfirm ? "SN Confirmation" : "SN Details"}</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.formCard}>
                    {sType?.toLowerCase() !== 'sn' && (
                        <>
                            <View style={styles.compactBox}>
                                <Text style={styles.infoLabel}>Pallet Code</Text>
                                <Text style={styles.infoValue}>{palletCode || "N/A"}</Text>
                            </View>
                            <View style={styles.compactBox}>
                                <Text style={styles.infoLabel}>Box Code</Text>
                                <Text style={styles.infoValue}>{boxCode || "N/A"}</Text>
                            </View>
                        </>
                    )}
                    <View style={styles.compactBox}>
                        <Text style={styles.infoLabel}>Total Qty</Text>
                        <Text style={styles.infoValue}>{totalQty}</Text>
                    </View>
                </View>

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 150 }]}>SN</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>IMEI1</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>IMEI2</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>IMEI3</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>Scan Time</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Oreder No</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {loading ? (
                                    <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                                ) : snData.length === 0 ? (
                                    <Text style={styles.emptyText}>No data found</Text>
                                ) : (
                                    snData.map((item, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.tableRow,
                                                { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" },
                                                selectedItemIndex === index && styles.selectedRow
                                            ]}
                                            onPress={() => setSelectedItemIndex(index)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.cell, { width: 150, color: "#0052cc" }]}>{item.sn}</Text>
                                            <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode1}</Text>
                                            <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode2}</Text>
                                            <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode3}</Text>
                                            <Text style={[styles.cell, { width: 150 }]}>{item.realDate}</Text>
                                            <Text style={[styles.cell, { width: 120 }]}>{item.orderCode}</Text>
                                        </TouchableOpacity>
                                    ))
                                ) || <Text style={styles.emptyText}>No items</Text>}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                {showConfirm && (
                    <View style={styles.actions}>
                        <TouchableOpacity style={[styles.actionBtn, styles.btnConfirm]} onPress={handleConfirm}>
                            <Text style={styles.btnTextPrimary}>Confirm Return</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const { width } = Dimensions.get("window");
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { backgroundColor: "#0052cc", paddingHorizontal: width * 0.05, height: scale(56), flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    headerLeft: { flexDirection: "row", alignItems: "center" },
    returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
    headerTitle: { color: "#FFFFFF", fontSize: scale(16), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
    content: { flex: 1, padding: 12 },
    formCard: {},
    compactBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: "#0052cc",
        height: 36,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        marginHorizontal: -4
    },
    infoLabel: {
        fontSize: 11,
        fontWeight: "700",
        color: "#FFFFFF",
        textTransform: "uppercase"
    },
    infoValue: {
        fontSize: 13,
        fontWeight: "800",
        color: "#FFFFFF"
    },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    selectedRow: { backgroundColor: "#ffc3c3ff" },
    emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 610 },
    actions: { marginTop: 12, gap: 10 },
    actionBtn: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnConfirm: { backgroundColor: '#0052cc' },
    btnCancel: { backgroundColor: '#E2E8F0' },
    btnTextPrimary: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    btnTextSecondary: { color: '#475569', fontSize: 15, fontWeight: '700' },
});
