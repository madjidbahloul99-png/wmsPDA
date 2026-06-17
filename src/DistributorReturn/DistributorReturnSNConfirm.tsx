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
    DeviceEventEmitter,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobal } from "../../GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function DistributorReturnSNConfirm({ navigation, route }: any) {
    const { f_orderId, f_barCode, f_scanType } = route.params;
    const global = useGlobal();
    const { gsURL, gs_factoryCode, gs_userName } = global;
    const BASE_URL = gsURL;

    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [itemList, setItemList] = useState<any[]>([]);
    const [label_title, setLabelTitle] = useState("");
    const [currentOrderId, setCurrentOrderId] = useState(f_orderId);

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            if (t) setToken(t);
        };
        loadToken();
    }, []);

    useEffect(() => {
        if (token) {
            getPalletSNConfirm();
        }
    }, [token]);

    const getPalletSNConfirm = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${BASE_URL}/api/DistributorReturnSNConfirm`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    factoryCode: gs_factoryCode,
                    orderId: currentOrderId,
                    barCode: f_barCode,
                    scanType: f_scanType
                }),
            });

            const result = await response.json();

            if (result.message === "success" && result.data && result.data.length > 0) {
                const data = result.data;
                setItemList(data);
                
                const firstRow = data[0];
                setCurrentOrderId(firstRow.orderId);
                setLabelTitle(`Distributor: ${firstRow.fromDistributor} OK: ${firstRow.okqty} ERR: ${firstRow.errorqty}`);
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
    };

    const button_Confirm_Click = () => {
        if (itemList.length > 0) {
            DeviceEventEmitter.emit('ON_DIST_RETURN_CONFIRM', { orderId: currentOrderId });
            navigation.goBack();
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} id="button_exit">
                        <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>SN Confirm</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.infoBanner}>
                    <Text style={styles.infoText}>{label_title || 'Loading...'}</Text>
                </View>

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 40 }]}>fxh</Text>
                                <Text style={[styles.headerCell, { width: 140 }]}>SN</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>imeiCode1</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>imeiCode2</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>imeiCode3</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>realdate</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>errorReason</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>boxCode</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>palletCode</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {loading ? (
                                    <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                                ) : (
                                    itemList.map((item, index) => (
                                        <View key={index} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" }]}>
                                            <Text style={[styles.cell, { width: 40, color: item.orderStatus === "-1" ? "#EF4444" : "#334155" }]}>{item.fxh}</Text>
                                            <Text style={[styles.cell, { width: 140, color: item.orderStatus === "-1" ? "#EF4444" : "#334155" }]}>{item.SN}</Text>
                                            <Text style={[styles.cell, { width: 130, color: item.orderStatus === "-1" ? "#EF4444" : "#334155" }]}>{item.imeiCode1}</Text>
                                            <Text style={[styles.cell, { width: 130, color: item.orderStatus === "-1" ? "#EF4444" : "#334155" }]}>{item.imeiCode2}</Text>
                                            <Text style={[styles.cell, { width: 130, color: item.orderStatus === "-1" ? "#EF4444" : "#334155" }]}>{item.imeiCode3}</Text>
                                            <Text style={[styles.cell, { width: 150, color: item.orderStatus === "-1" ? "#EF4444" : "#334155" }]}>{item.realdate}</Text>
                                            <Text style={[styles.cell, { width: 150, color: item.orderStatus === "-1" ? "#EF4444" : "#334155" }]}>{item.errorReason}</Text>
                                            <Text style={[styles.cell, { width: 150, color: item.orderStatus === "-1" ? "#EF4444" : "#334155" }]}>{item.boxCode}</Text>
                                            <Text style={[styles.cell, { width: 150, color: item.orderStatus === "-1" ? "#EF4444" : "#334155" }]}>{item.palletCode}</Text>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footerRow}>
                    <Text style={styles.totalQtyText} id="label_qtyTotal">Total qty: {itemList.length}</Text>
                    <TouchableOpacity
                        id="button_Confirm"
                        style={styles.confirmBtn}
                        onPress={button_Confirm_Click}
                        disabled={loading || itemList.length === 0}
                    >
                        <Text style={styles.confirmBtnText}>Confirm</Text>
                    </TouchableOpacity>
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
    headerTitle: { color: "#FFFFFF", fontSize: scale(16), fontWeight: "900" },
    headerRight: { flexDirection: "row", alignItems: "center" },
    userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
    content: { flex: 1, padding: 8 },
    infoBanner: { backgroundColor: '#E0F2FE', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#7DD3FC' },
    infoText: { fontSize: 11, fontWeight: '700', color: '#1E40AF' },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 8 },
    headerCell: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600", paddingHorizontal: 4 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    totalQtyText: { fontSize: 14, fontWeight: '900', color: '#0052cc' },
    confirmBtn: { backgroundColor: "#0052cc", paddingHorizontal: 30, paddingVertical: 10, borderRadius: 10, elevation: 2 },
    confirmBtnText: { color: "#FFF", fontWeight: "900", fontSize: 14 },
});
