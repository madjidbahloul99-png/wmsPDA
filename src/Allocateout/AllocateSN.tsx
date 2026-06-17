 import React, { useState, useEffect, useMemo } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    FlatList,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Alert,
    StatusBar,
    ActivityIndicator,
    ListRenderItem,
    Image,
    Dimensions,
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
    createDate: string;
}

export default function AllocateSN({ navigation, route }: any) {
    const { allocateCode, palletCode: initialPalletCode, boxCode: initialBoxCode } = route.params || {};
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_wareCode, gs_userName,operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<SNDetail[]>([]);
    const [title, setTitle] = useState("");


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
            fetchSNDetails();
        }
    }, [token]);

    const fetchSNDetails = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/AllocatePalletSN`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    FactoryCode: gs_factoryCode,
                    WareHouseCode: gs_wareCode,
                    AllocateCode: allocateCode,
                    PalletCode: initialPalletCode || "",
                    BoxCode: initialBoxCode || ""
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
            console.log("allocatesn ", result)
            if (result.message === 'success' && result.data && result.data.length > 0) {
                const mappedData = result.data.map((row: any, index: number) => ({
                    id: index.toString(),
                    fxh: row.fxh?.toString(),
                    SN: row.sn,
                    model: row.model,
                    color: row.color,
                    imeiCode1: row.imeiCode1,
                    imeiCode2: row.imeiCode2,
                    imeiCode3: row.imeiCode3,
                    createDate: row.createDate,
                }));

                setItems(mappedData);
                const first = result.data[0];
                setTitle(`${first.model} ${first.color}`);
            } else {
                Alert.alert("Error",  "There is no product in the box!");
                navigation.goBack();
            }
        } catch (error) {
            Alert.alert("Error", "Failed to load SN details");
        } finally {
            setLoading(false);
        }
    };

    const renderItem: ListRenderItem<SNDetail> = ({ item, index }) => (
        <View
            style={[
                styles.row,
                index % 2 === 0
                    ? { backgroundColor: "#FFFFFF" }
                    : { backgroundColor: "#BAE6FD" }
            ]}
        >
            <Text style={[styles.cell, { width: 40 }]}>{index + 1}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.SN}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode1}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode2}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode3}</Text>
            <Text style={[styles.cell, { width: 200 }]}>{item.createDate}</Text>
        </View>
    );

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
                    <Text style={styles.headerTitle}>SN Details</Text>
                </View>

                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.statsCard}>
                    {allocateCode && allocateCode !== "" && (
                        <>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Pallet </Text>
                                <Text style={styles.statValue}>{initialPalletCode}</Text>
                            </View>

                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>Box</Text>
                                <Text style={styles.statValue}>{initialBoxCode}</Text>
                            </View>
                        </>
                    )}

                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Total QTY</Text>
                        <Text style={styles.statValue}>{items.length}</Text>
                    </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View style={{ width: 750}}>
                        <FlatList
                            data={items}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            ListHeaderComponent={
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.headerCell, { width: 40 }]}>No</Text>
                                    <Text style={[styles.headerCell, { width: 150 }]}>SN</Text>
                                    <Text style={[styles.headerCell, { width: 120 }]}>IMEI 1</Text>
                                    <Text style={[styles.headerCell, { width: 120 }]}>IMEI 2</Text>
                                    <Text style={[styles.headerCell, { width: 120 }]}>IMEI 3</Text>
                                    <Text style={[styles.headerCell, { width: 200 }]}>Date</Text>
                                </View>
                            }
                            stickyHeaderIndices={[0]}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    {loading ? <ActivityIndicator color="#4F46E5" /> : <Text style={styles.emptyText}>No data available</Text>}
                                </View>
                            }
                        />
                    </View>
                </ScrollView>
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
        paddingVertical: 4,
        borderRadius: 12,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        height: 35,
        marginBottom:-4
    },
    statLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10, borderRadius: 8, marginBottom: 8 },
    headerCell: { fontSize: 12, fontWeight: "900", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    row: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", borderRadius: 8, marginBottom: 4 },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    emptyContainer: { padding: 40, alignItems: "center" },
    emptyText: { color: "#94A3B8", fontWeight: "600", fontSize: 14 },
});
