import React, { useState, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    StatusBar,
    FlatList,
    Alert,
    Image,
    Dimensions,
    ScrollView,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SNItem {
    id: string;
    fxh: string;
    sn: string;
    imei1: string;
    imei2: string;
    imei3: string;
    model: string;
    color: string;
    date: string;
    orderCode: string;
}

export default function InWarehouseSNConfirm({ navigation, route }: any) {
    const { palletCode, boxCode, sn, showConfirm = true, sType, currentSn } = route.params;
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName, gs_wareType,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
     } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(true);
    const [snList, setSnList] = useState<SNItem[]>([]);
    const [headerInfo, setHeaderInfo] = useState({ model: "", color: "" });

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
            if (gs_wareType !== "MainWarehouse") {
                Alert.alert("Error", "Only the main warehouse can be put in storage!");
                navigation.goBack();
                return;
            }
            fetchSNDetails();
        }
    }, [token]);

    const fetchSNDetails = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/InPalletSNConfirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode,
                    palletCode: palletCode || "",
                    boxCode: boxCode || "",
                    sn: sn || "",
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
            if (result.message === "success" && result.data) {
                const mapped = result.data.map((item: any, index: number) => ({
                    id: index.toString(),
                    fxh: item.fxh,
                    sn: item.sn || item.scanBarcode,
                    imei1: item.imeiCode1,
                    imei2: item.imeiCode2,
                    imei3: item.imeiCode3,
                    model: item.model,
                    color: item.color,
                    date: item.realdate,
                    orderCode: item.orderCode,
                }));
                setSnList(mapped);
                if (mapped.length > 0) {
                    setHeaderInfo({ model: mapped[0].model, color: mapped[0].color });
                }
            } else {
                Alert.alert("Error", "There is no product in the Box!");
                setSnList([]);
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        navigation.navigate('InWarehouse', {
            confirmed: true,
            palletCode: palletCode,
            sType: sType,
            currentSn: currentSn
        });
    };

    const handleCancel = () => {
        navigation.navigate('InWarehouse', { cancelled: true });
    };

    const handleReturn = () => {
        navigation.goBack();
    };

    const renderItem = ({ item }: { item: SNItem }) => (
        <View style={styles.tableRow}>
            <Text style={[styles.cell, { width: 50 }]}>{item.fxh}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.sn}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.imei1}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.imei2}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.imei3}</Text>
            <View style={{ width: 120 }}>
                <Text style={styles.cellMain}>{item.model}</Text>
                <Text style={styles.cellSub}>{item.color}</Text>
            </View>
            <Text style={[styles.cell, { width: 120 }]}>{item.date}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.orderCode}</Text>
        </View>
    );

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
                    <Text style={styles.headerTitle}>Confirm SN </Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.statsCard}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Pallet</Text>
                        <Text style={styles.statValue}>{palletCode || "N/A"}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Box</Text>
                        <Text style={styles.statValue}>{boxCode || "N/A"}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Total Qty</Text>
                        <Text style={styles.statValue}>{snList.length}</Text>
                    </View>
                </View>

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 50 }]}>No</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>SN</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>IMEI1</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>IMEI2</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>IMEI3</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>Model</Text>
                                <Text style={[styles.headerCell, { width: 80 }]}>Color</Text>
                                <Text style={[styles.headerCell, { width: 200 }]}>Date</Text>
                                <Text style={[styles.headerCell, { width: 120 }]}>Order</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {loading ? (
                                    <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                                ) : (
                                    <FlatList
                                        data={snList}
                                        renderItem={({ item, index }) => (
                                            <View
                                                style={[
                                                    styles.tableRow,
                                                    index % 2 === 0
                                                        ? { backgroundColor: "#FFFFFF" }
                                                        : { backgroundColor: "#BAE6FD" }
                                                ]}
                                            >
                                                <Text style={[styles.cell, { width: 50 }]}>{item.fxh}</Text>
                                                <Text style={[styles.cell, { width: 150, color: "#0052cc" }]}>{item.sn}</Text>
                                                <Text style={[styles.cell, { width: 150 }]}>{item.imei1}</Text>
                                                <Text style={[styles.cell, { width: 150 }]}>{item.imei2}</Text>
                                                <Text style={[styles.cell, { width: 150 }]}>{item.imei3}</Text>
                                                <Text style={[styles.cell, { width: 100 }]}>{item.model}</Text>
                                                <Text style={[styles.cell, { width: 80 }]}>{item.color}</Text>
                                                <Text style={[styles.cell, { width: 200 }]}>{item.date}</Text>
                                                <Text style={[styles.cell, { width: 120 }]}>{item.orderCode}</Text>
                                            </View>
                                        )}
                                        keyExtractor={(item) => item.id}
                                        scrollEnabled={false}
                                        ListEmptyComponent={() => (
                                            <Text style={styles.emptyText}>No SNs found.</Text>
                                        )}
                                    />
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                {showConfirm && (
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                )}
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
    content: { flex: 1, padding: 16 },
    statsCard: { flexDirection: 'column', gap: 6, marginBottom: 12 },
    statBox: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#0052cc",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        height: 32,
    },
    statLabel: { color: "#FFF", fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFF", fontSize: 12, fontWeight: "800" },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    cellMain: { fontSize: 11, color: "#1E293B", fontWeight: "700", textAlign: "center" },
    cellSub: { fontSize: 10, color: "#64748B", textAlign: "center" },
    footer: { flexDirection: "row", gap: 12, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    cancelButton: { flex: 1, backgroundColor: "#F1F5F9", height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#CBD5E1" },
    cancelButtonText: { color: "#64748B", fontWeight: "900" },
    confirmButton: { flex: 2, backgroundColor: "#4F46E5", height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    confirmButtonText: { color: "#FFF", fontWeight: "900" },
    emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 800 },
});

