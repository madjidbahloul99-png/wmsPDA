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
    DeviceEventEmitter,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SNDetail {
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
    allocateCode: string;
    systemAllocateCode: string;
}

export default function AllocateRejectInSNConfirm({ navigation, route }: any) {
    const { sn, scanType, onConfirm, onCancel, showConfirm, allocateCode: initialAllocateCode } = route.params || {};
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName,operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = global;
    const BASE_URL = gsURL;
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<SNDetail[]>([]);
    const [allocateCode, setAllocateCode] = useState(initialAllocateCode || "");
    const [systemBill, setSystemBill] = useState("");
    const [palletCode, setPalletCode] = useState(route.params?.palletCode || "");
    const [boxCode, setBoxCode] = useState(route.params?.boxCode || "");
    const [headerTitle, setHeaderTitle] = useState("");


    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            console.log("TOKEN IN reject", t);
            if (t) setToken(t);
        };

        loadToken();
    }, []);

    useEffect(() => {
        if (token) {
            fetchDetails();
        }
    }, [token]);



    const fetchDetails = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/AllocateInPalletSNConfirmInject`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode,
                    allocateCode: allocateCode,
                    palletCode: palletCode,
                    boxCode: boxCode,
                    SN: sn,
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
            console.log("hello", result);
            if (result.message === 'success' && result.data && result.data.length > 0) {
                let fmodel = "";
                let fcolor = "";
                let currentPallet = palletCode;
                let currentBox = boxCode;

                const mapped = result.data.map((item: any, index: number) => {
                    if (scanType === "sn") {
                        currentPallet = item.palletCode || "";
                        currentBox = item.boxCode || "";
                    }

                    fmodel = item.model || "";
                    fcolor = item.color || "";

                    return {
                        id: index.toString(),
                        fxh: item.fxh,
                        sn: item.sn || sn,
                        imei1: item.imeiCode1,
                        imei2: item.imeiCode2,
                        imei3: item.imeiCode3,
                        model: item.model,
                        color: item.color,
                        date: item.realDate,
                        orderCode: item.orderCode,
                        allocateCode: item.allocateCode,
                        systemAllocateCode: item.systemAllocateCode,
                    };
                });

                setDetails(mapped);

                if (!allocateCode) {
                    setAllocateCode(result.data[0].allocateCode || "");
                }

                setSystemBill(result.data[0].systemAllocateCode || "");
                setPalletCode(currentPallet);
                setBoxCode(currentBox);



            } else {
                Alert.alert("Error", "There is no product in the Pallet!");
                onCancel?.();
                navigation.goBack();
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
            onCancel?.();
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };





    const handleReturn = () => {
        DeviceEventEmitter.emit("ON_ALLOCATE_REJECT_CONFIRM", {
            action: "CANCEL"
        });
        navigation.goBack();
    };

    const renderItem = ({ item, index }: { item: SNDetail, index: number }) => (
        <View
            style={[
                styles.tableRow,
                index % 2 === 0
                    ? { backgroundColor: "#FFFFFF" }
                    : { backgroundColor: "#BAE6FD" }
            ]}
        >
            <Text style={[styles.cell, { width: 40 }]}>{item.fxh}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.sn}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.imei1}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.imei2}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.imei3}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
            <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.date}</Text>
            <Text style={[styles.cell, { width: 150 }]}>{item.orderCode}</Text>
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
                    <Text style={styles.headerTitle}>{headerTitle || "SN Confirmation"}</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.statsCard}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Pallet</Text>
                    <Text style={styles.statValue}>{palletCode || "-"}</Text>
                </View>

                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Box Code</Text>
                    <Text style={styles.statValue}>{boxCode || "-"}</Text>
                </View>

                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Total qty</Text>
                    <Text style={styles.statValue}>{details.length}</Text>
                </View>

            </View>


            <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    {loading ? (
                        <View style={{ width: width * 1.5, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
                            <ActivityIndicator size="large" color="#0052cc" />
                        </View>
                    ) : (
                        <FlatList
                            data={details}
                            renderItem={({ item, index }) => renderItem({ item, index })}
                            keyExtractor={(item) => item.id}
                            ListHeaderComponent={
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.headerCell, { width: 40 }]}>No</Text>
                                    <Text style={[styles.headerCell, { width: 150 }]}>SN</Text>
                                    <Text style={[styles.headerCell, { width: 150 }]}>IMEI1</Text>
                                    <Text style={[styles.headerCell, { width: 150 }]}>IMEI2</Text>
                                    <Text style={[styles.headerCell, { width: 150 }]}>IMEI3</Text>
                                    <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                                    <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                                    <Text style={[styles.headerCell, { width: 150 }]}>Date</Text>
                                    <Text style={[styles.headerCell, { width: 150 }]}>Order</Text>
                                </View>
                            }
                            stickyHeaderIndices={[0]}
                            contentContainerStyle={{ paddingBottom: 20 }}
                        />
                    )}
                </ScrollView>
            </View>

            {showConfirm && (
                <View style={styles.footer}>
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.btnPrimary]}
                            onPress={() => {
                                if (details.length >= 1) {
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
                                                        "ON_ALLOCATE_REJECT_CONFIRM",
                                                        {
                                                            action: "OK",
                                                            barCode: sn,
                                                            scanType: scanType,
                                                            allocateCode: allocateCode
                                                        }
                                                    );

                                                    navigation.goBack();
                                                }
                                            }
                                        ]
                                    );
                                } else {
                                    navigation.goBack();
                                }
                            }}
                        >
                            <Text style={styles.btnTextPrimary}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
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
    statsCard: { padding: 16, gap: 8 },
    statBox: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#0052cc",
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 12,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E2E8F0"
    },
    statLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    statInput: { flex: 1, textAlign: 'right', color: "#1E293B", fontSize: 12, fontWeight: "800", padding: 0, height: 24 },
    tagCard: { backgroundColor: "#E0E7FF", marginHorizontal: 16, padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    tagLabel: { color: "#4338CA", fontSize: 11, fontWeight: "700", marginRight: 6 },
    tagValue: { color: "#1E293B", fontSize: 11, fontWeight: "800" },
    tableCard: { flex: 1, backgroundColor: "#FFF", marginHorizontal: 16, borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: -4 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    cellMain: { fontSize: 11, color: "#1E293B", fontWeight: "700", textAlign: "center" },
    cellSub: { fontSize: 10, color: "#64748B", textAlign: "center" },
    footer: { padding: 16 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnPrimary: { backgroundColor: '#2563eb' },
    btnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '800' },
    
});
