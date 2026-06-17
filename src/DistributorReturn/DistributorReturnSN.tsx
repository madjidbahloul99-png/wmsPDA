import React, { useState, useEffect } from "react";
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobal } from "../../GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function DistributorReturnSN({ navigation, route }: any) {
    const { f_orderId } = route.params;
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName } = global;
    const BASE_URL = gsURL;

    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [itemList, setItemList] = useState<any[]>([]);

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            if (t) setToken(t);
        };
        loadToken();
    }, []);

    useEffect(() => {
        if (token && f_orderId) {
            fetchSNDetails();
        }
    }, [token, f_orderId]);

    const fetchSNDetails = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/DistributorReturnSN`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    factoryCode: gs_factoryCode,
                    orderId: f_orderId
                }),
            });

            const result = await response.json();

            if (result.message === "success" && result.data) {
                setItemList(result.data);
            } else {
                Alert.alert("Error", "There is no product in the Pallet!");
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                        <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Order: {f_orderId} SN Detail</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 50 }]}>#</Text>
                                <Text style={[styles.headerCell, { width: 140 }]}>SN</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>Model</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>IMEI 1</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>IMEI 2</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>IMEI 3</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>Create Date</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>Box Code</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>Pallet Code</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {loading ? (
                                    <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                                ) : itemList.length === 0 ? (
                                    <View style={{ width: 1100, padding: 40 }}>
                                        <Text style={styles.emptyText}>No detail data found!</Text>
                                    </View>
                                ) : (
                                    itemList.map((item, index) => (
                                        <View key={index} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" }]}>
                                            <Text style={[styles.cell, { width: 50 }]}>{item.fxh}</Text>
                                            <Text style={[styles.cell, { width: 140 }]}>{item.SN}</Text>
                                            <Text style={[styles.cell, { width: 130 }]}>{item.model}</Text>
                                            <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
                                            <Text style={[styles.cell, { width: 130 }]}>{item.imeiCode1}</Text>
                                            <Text style={[styles.cell, { width: 130 }]}>{item.imeiCode2}</Text>
                                            <Text style={[styles.cell, { width: 130 }]}>{item.imeiCode3}</Text>
                                            <Text style={[styles.cell, { width: 150 }]}>{item.createDate}</Text>
                                            <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
                                            <Text style={[styles.cell, { width: 150 }]}>{item.palletCode}</Text>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footerRow}>
                    <Text style={styles.totalQtyText}>Total qty: {itemList.length}</Text>
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
    headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
    content: { flex: 1, padding: 8 },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 8 },
    headerCell: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600", paddingHorizontal: 4 },
    emptyText: { textAlign: "center", color: "#94A3B8", fontStyle: "italic" },
    footerRow: { paddingVertical: 8, alignItems: 'flex-start' },
    totalQtyText: { fontSize: 14, fontWeight: '900', color: '#0052cc' },
});
