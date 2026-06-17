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
    ActivityIndicator,
    Alert,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function DeliveryReturnSNBox({ navigation, route }: any) {
    const { palletCode, deliveryCode } = route.params;
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName, gs_wareCode,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
    } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(false);
    const [boxData, setBoxData] = useState<any[]>([]);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

    const totalQty = boxData.reduce((acc, curr) => acc + (parseInt(curr.qty) || 0), 0);

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
                const response = await fetch(`${BASE_URL}/api/DeliveryReturnpalletsnbox/box`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                    body: JSON.stringify({
                        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                        factoryCode: gs_factoryCode,
                        wareHouseCode: gs_wareCode,
                        deliveryCode
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
                console.log("box details ", result)
                if (result.message === "success" && result.data && result.data.length > 0) {
                    setBoxData(result.data);
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

    const handleReturn = () => {
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
                    <Text style={styles.headerTitle}>Box Details</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.formCard}>
                    <View style={styles.compactBox}>
                        <Text style={styles.infoLabel}>Pallet Code</Text>
                        <Text style={styles.infoValue}>{palletCode || "N/A"}</Text>
                    </View>
                </View>

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 150 }]}>Box Code</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>Pallet Code</Text>
                                <Text style={[styles.headerCell, { width: 60 }]}>Qty</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>

                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {loading ? (
                                    <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                                ) : boxData.length === 0 ? (
                                    <Text style={styles.emptyText}>No data found</Text>
                                ) : (
                                    boxData.map((item, index) => (
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
                                            <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
                                            <Text style={[styles.cell, { width: 150 }]}>{item.palletCode}</Text>
                                            <Text style={[styles.cell, { width: 60 }]}>{item.qty}</Text>
                                            <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
                                            <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>

                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.detailButton, selectedItemIndex === null && styles.disabledButton]}
                        onPress={() => {
                            if (selectedItemIndex === null) {
                                Alert.alert("Selection Required", "Please select a row first to view barcode details.");
                                return;
                            }
                            navigation.navigate("DeliveryReturnSN", {
                                palletCode,
                                boxCode: boxData[selectedItemIndex].boxCode,
                                deliveryCode
                            });
                        }}
                    >
                        <Text style={styles.detailButtonText}>Barcode Details</Text>
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
    compactBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: "#0052cc",
        height: 38,
        borderRadius: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        marginBottom: 12

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
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#FFFFFF" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 670 },
    footer: { marginTop: 12 },
    detailButton: { backgroundColor: "#0052cc", padding: 12, borderRadius: 12, alignItems: "center" },
    detailButtonText: { color: "#FFF", fontWeight: "900", fontSize: 15 },
    selectedRow: { backgroundColor: "#ffc3c3ff" },
    disabledButton: { backgroundColor: "#0052cc" },
});
