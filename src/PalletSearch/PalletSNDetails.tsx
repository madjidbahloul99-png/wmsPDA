import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    StatusBar,
    Alert,
    Image,
    Dimensions,
    ScrollView,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SNDetail {
    id: string;
    fxh: string;
    SN: string;
    model: string;
    color: string;
    imeiCode1: string;
    imeiCode2: string;
    imeiCode3: string;
    realdate: string;
    orderCode: string;
}

export default function PalletSNDetails({ navigation, route }: any) {
    const { palletCode, boxCode } = route.params || {};
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_wareCode, gs_userName ,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
    } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<SNDetail[]>([]);
    const [qtyTotal, setQtyTotal] = useState(0);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
    const [model, setModel] = useState("");
    const [color, setColor] = useState("");

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            console.log("TOKEN IN Allocateout", t);
            if (t) setToken(t);
        };

        loadToken();
    }, []);

    const fetchDetails = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/DeliveryPalletSNConfirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode,
                    fromWareHouseCode: gs_wareCode,
                    palletCode: palletCode,
                    boxCode: boxCode,
                    SN: "",
                    scanType: "pallet",
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
            console.log("palletSNsearche", result);
            if (result.message === 'success' && result.data && result.data.length > 0) {
                setModel(result.data[0].model || "");
                setColor(result.data[0].color || "");

                const mapped = result.data.map((item: any, index: number) => ({
                    id: index.toString(),
                    fxh: item.fxh,
                    SN: item.sn,
                    model: item.model,
                    color: item.color,
                    imeiCode1: item.imeiCode1,
                    imeiCode2: item.imeiCode2,
                    imeiCode3: item.imeiCode3,
                    realdate: item.realDate,
                    orderCode: item.orderCode,
                }));
                setDetails(mapped);
                setQtyTotal(mapped.length);
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
    }, [palletCode, boxCode, gs_factoryCode, gs_wareCode, BASE_URL, token, navigation]);

    useEffect(() => {
        if (token) {
            fetchDetails();
        }
    }, [fetchDetails, token]);

    const renderItem = ({ item, index }: { item: SNDetail; index: number }) => (
        <TouchableOpacity
            style={[
                styles.tableRow,
                { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" },
                selectedItemIndex === index && styles.selectedRow
            ]}
            onPress={() => setSelectedItemIndex(index)}
            activeOpacity={0.7}
        >
            <Text style={[styles.cell, { width: 50 }]}>{item.fxh}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.SN}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode1}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode2}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode3}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.orderCode}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.realdate}</Text>
        </TouchableOpacity>
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
                    <Text style={styles.headerTitle}>SN Details</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.statsCard}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Pallet</Text>
                    <Text style={styles.statValue}>{palletCode}</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Total Qty</Text>
                    <Text style={styles.statValue}>{qtyTotal}</Text>
                </View>
            </View>

            <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, { width: 50 }]}>No</Text>
                            <Text style={[styles.headerCell, { width: 150 }]}>SN</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>IMEI1</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>IMEI2</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>IMEI3</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>Order</Text>
                            <Text style={[styles.headerCell, { width: 150 }]}>Date</Text>
                        </View>

                        {loading ? (
                            <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                        ) : (
                            <FlatList
                                data={details}
                                renderItem={renderItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                scrollEnabled={true}
                            />
                        )}
                    </View>
                </ScrollView>
            </View>

        </SafeAreaView>
    );
}

const { width } = Dimensions.get("window");
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
    headerLeft: { flexDirection: "row", alignItems: "center" },
    returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
    headerTitle: { color: "#FFFFFF", fontSize: isSmallDevice ? scale(14) : scale(16), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700", marginRight: 1 },
    statsCard: { padding: 16, gap: 10 },
    statBox: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#0052cc",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0"
    },
    statLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    modelInfoCard: {
        backgroundColor: "#FFF",
        padding: 12,
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 16,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0"
    },
    modelInfoLabel: { fontSize: 13, fontWeight: "700", color: "#64748B", marginBottom: 4, textTransform: "uppercase" },
    modelInfoValue: { fontSize: 13, color: "#1E293B", fontWeight: "700" },
    tableCard: { flex: 1, backgroundColor: "#FFF", marginHorizontal: 16, borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    selectedRow: { backgroundColor: "#ffc3c3ff" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    actionBtn: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnSecondary: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    btnTextSecondary: { color: '#475569', fontSize: 15, fontWeight: '700' },
});
