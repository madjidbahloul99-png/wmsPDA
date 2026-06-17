import React, { useState, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Alert,
    ActivityIndicator,
    Image,
    Dimensions,
    TextInput,
    DeviceEventEmitter
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

type SNDetail = {
    fxh: string;
    sn: string;
    imeiCode1: string;
    imeiCode2: string;
    imeiCode3: string;
    realdate: string;
    orderCode: string;
    model: string;
    color: string;
    palletCode: string;
    boxCode: string;
};



export default function DeliverySNConfirm({ navigation, route }: any) {
    const { gsURL, setgs_gsURL } = useGlobal();
    const BASE_URL = gsURL;
    const { fromWareHouseCode, palletCode: initialPalletCode, boxCode: initialBoxCode, SN, scanType, showConfirm, onConfirm, onCancel } = route.params || {};
    const global = useGlobal();
    const [token, setToken] = useState("");

    const [loading, setLoading] = useState(false);
    const [details, setDetails] = useState<SNDetail[]>([]);
    const [palletCode, setPalletCode] = useState(initialPalletCode || "");
    const [boxCode, setBoxCode] = useState(initialBoxCode || "");
    const [model, setModel] = useState("");
    const [color, setColor] = useState("");
    const [qty, setQty] = useState("0");
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
            const response = await fetch(`${BASE_URL}/api/DeliveryPalletSNConfirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, },
                body: JSON.stringify({
                    factoryCode: global.gs_factoryCode,
                    fromWareHouseCode: fromWareHouseCode,
                    palletCode: initialPalletCode,
                    boxCode: initialBoxCode,
                    sn: SN,
                    scanType: scanType
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
            console.log("message6", result);
            if (result.message == "success" && result.data && result.data.length > 0) {
                const list: SNDetail[] = result.data.map((item: any) => ({
                    fxh: item.fxh,
                    sn: item.sn,
                    imeiCode1: item.imeiCode1,
                    imeiCode2: item.imeiCode2,
                    imeiCode3: item.imeiCode3,
                    realdate: item.realDate,
                    orderCode: item.orderCode,
                    model: item.model,
                    color: item.color,
                    palletCode: item.palletCode,
                    boxCode: item.boxCode
                }));

                setDetails(list);

                let currentPallet = initialPalletCode;
                let currentBox = initialBoxCode;

                // Update pallet/box if scanType is sn (Logic from C#)
                if (scanType === "sn") {
                    currentPallet = list[0].palletCode;
                    currentBox = list[0].boxCode;
                    setPalletCode(currentPallet);
                    setBoxCode(currentBox);
                }

                setModel(list[0].model);
                setColor(list[0].color);

                setQty(list.length.toString());
                // Final title logic: Pallet:P Box:B Model Color
                //const baseTitle = `Pallet: ${currentPallet} Box: ${currentBox}`;
                //setTitle(`${baseTitle} ${list[0].model} ${list[0].color}`);
            } else {
                Alert.alert("Error", `There is no product for the ${scanType}!`);
                navigation.goBack();
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to fetch SN details");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (details.length < 1) {
            navigation.goBack();
            return;
        }

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
                            "ON_DELIVERY_CONFIRM_OK",
                            {
                                barCode: SN,
                                scanType
                            }
                        );

                        navigation.goBack();
                    }
                }
            ]
        );
    };
    const handleExit = () => {
        navigation.goBack();
    };

    const tableHeaders = ["No", "SN", "IMEI 1", "IMEI 2", "IMEI 3", "Date", "Order"];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={handleExit} activeOpacity={0.7}>
                        <Image
                            source={require("../../assets/logo/left.png")}
                            style={styles.returnLogo}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Confirm SN</Text>
                </View>

                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{global.gs_userName}</Text>
                </View>
            </View>

            <View style={styles.statsCard}>

                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Pallet</Text>
                    <TextInput
                        style={styles.statInput}
                        value={palletCode}
                        onChangeText={setPalletCode}
                        placeholder="-"
                    />
                </View>

                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Box</Text>
                    <TextInput
                        style={styles.statInput}
                        value={boxCode}
                        onChangeText={setBoxCode}
                        placeholder="-"
                    />
                </View>

                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Total Qty</Text>
                    <TextInput
                        style={styles.statInput}
                        value={qty}
                        editable={false}
                    />
                </View>


                {/* Add QTY input */}
                {scanType == "sn" && (
                    <>


                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>SN</Text>
                            <TextInput
                                style={styles.statInput}
                                value={SN}
                                editable={false}
                                placeholder="-"
                            />
                        </View>
                    </>
                )}
            </View>


            {/* List Card */}
            <View style={styles.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.headerCell, { width: 60 }]}>No</Text>
                            <Text style={[styles.headerCell, { width: 150 }]}>SN</Text>
                            <Text style={[styles.headerCell, { width: 140 }]}>IMEI 1</Text>
                            <Text style={[styles.headerCell, { width: 140 }]}>IMEI 2</Text>
                            <Text style={[styles.headerCell, { width: 140 }]}>IMEI 3</Text>
                            <Text style={[styles.headerCell, { width: 150 }]}>Date</Text>
                            <Text style={[styles.headerCell, { width: 120 }]}>Order</Text>
                        </View>

                        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator>
                            {details.length > 0 ? (
                                details.map((item, index) => (
                                    <View key={index} style={[styles.row, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" }]}>
                                        <Text style={[styles.cell, { width: 60 }]}>{item.fxh}</Text>
                                        <Text style={[styles.cell, { width: 150 }]}>{item.sn}</Text>
                                        <Text style={[styles.cell, { width: 140 }]}>{item.imeiCode1}</Text>
                                        <Text style={[styles.cell, { width: 140 }]}>{item.imeiCode2}</Text>
                                        <Text style={[styles.cell, { width: 140 }]}>{item.imeiCode3}</Text>
                                        <Text style={[styles.cell, { width: 150 }]}>{item.realdate}</Text>
                                        <Text style={[styles.cell, { width: 120 }]}>{item.orderCode}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text style={[styles.emptyText, { width: 810 }]}>No data available</Text>
                            )}
                        </ScrollView>
                    </View>
                </ScrollView>
            </View>

            {showConfirm && (
                <View style={styles.footer}>
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.btnPrimary]}
                            onPress={handleConfirm}
                        >
                            <Text style={styles.btnTextPrimary}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
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
    statsCard: { padding: 16, gap: 8, marginBottom: -8 },
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
        borderColor: "#E2E8F0",

    },
    statLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
    statValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
    statInput: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", padding: 0, height: 25, textAlign: 'right', flex: 1 },
    tagRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
    tagCard: { flex: 1, backgroundColor: "#F1F5F9", padding: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    tagLabel: { color: "#64748B", fontSize: 10, fontWeight: "700", marginRight: 4 },
    tagValue: { color: "#1E293B", fontSize: 10, fontWeight: "800" },
    tableCard: { flex: 1, backgroundColor: "#FFF", marginHorizontal: 16, borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 0 },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
    headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    row: { flexDirection: "row", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
    emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 40, fontStyle: "italic" },
    footer: { padding: 16 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    btnPrimary: { backgroundColor: '#10B981' },
    btnSecondary: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    btnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '800' },
    btnTextSecondary: { color: '#475569', fontSize: 15, fontWeight: '700' },
});
