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

export default function DeliveryReturnSNConfirmBox({ navigation, route }: any) {
    const { palletCode, sType, currentSn, deliveryCode, systemDeliveryCode, tock } = route.params;
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_wareCode, gs_userName, operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(false);
    const [palletData, setPalletData] = useState<any[]>([]);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

    const totalQty = palletData.reduce((acc, item) => acc + (Number(item.qty) || 0), 0);

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
                const response = await fetch(`${BASE_URL}/api/DeliveryReturnPalletSNConfirmBox`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                    body: JSON.stringify({
                        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                        factoryCode: gs_factoryCode,
                        deliveryCode,
                        barCode: currentSn,
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
                console.log("confirmbox", result)
                if (result.message === "success" && result.data.length > 0) {
                    setPalletData(result.data);
                } else {
                    Alert.alert("Error", "There is no product in the Pallet!");
                    navigation.goBack();

                }
            } catch (err: any) {
                Alert.alert("Error", err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, palletCode, deliveryCode]);

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

    const handleBoxDetail = () => {
        if (selectedItemIndex === null) {
            Alert.alert("Notice", "Please select a row first!");
            return;
        }

        const selectedItem = palletData[selectedItemIndex];
        if (selectedItem) {
            navigation.navigate("DeliveryReturnSNConfirm", {
                palletCode,
                sType,
                currentSn: "",
                boxCode: selectedItem.boxCode,
                deliveryCode,
                showConfirm: false
            });
        }
    };

    const handleReturn = () => {
        DeviceEventEmitter.emit('ON_DELIVERY_RETURN_CANCEL');
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
                    <Text style={styles.headerTitle}>Box Confirmation</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.formCard}>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Pallet Code</Text>
                        <Text style={styles.infoValue}>{palletCode}</Text>
                    </View>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Total Qty</Text>
                        <Text style={styles.infoValue}>{totalQty}</Text>
                    </View>
                </View>

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 150 }]}>Box Code</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                                <Text style={[styles.headerCell, { width: 60 }]}>Qty</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Order NO</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {loading ? (
                                    <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                                ) : palletData.length === 0 ? (
                                    <Text style={styles.emptyText}>No data found</Text>
                                ) : (
                                    palletData.map((item, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.tableRow,
                                                { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" },
                                                selectedItemIndex === index && styles.selectedRow
                                            ]}
                                            onPress={() => setSelectedItemIndex(index)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
                                            <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
                                            <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
                                            <Text style={[styles.cell, { width: 60 }]}>{item.qty}</Text>
                                            <Text style={[styles.cell, { width: 120 }]}>{item.orderCode}</Text>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity style={[styles.actionBtn, styles.btnDetail]} onPress={handleBoxDetail}>
                        <Text style={styles.btnTextDetail}>Barcode Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, styles.btnConfirm]} onPress={handleConfirm}>
                        <Text style={styles.btnTextPrimary}>Confirm Return</Text>
                    </TouchableOpacity>

                </View>
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
    infoBox: {
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
    selectedRow: { backgroundColor: "#ffc3c3ff" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 550 },
    actions: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 10
    },
    actionBtn: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center'
    },
    btnConfirm: { backgroundColor: '#0052cc' },
    btnDetail: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#0052cc' },
    btnTextPrimary: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    btnTextDetail: { color: '#0052cc', fontSize: 15, fontWeight: '700' },
});
