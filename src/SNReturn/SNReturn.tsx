import React, { useState, useEffect, useRef } from "react";
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
    TextInput,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useGlobal } from "../../GlobalContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function SNReturn({ navigation }: any) {
    const global = useGlobal();
    const {
        gsURL, gs_factoryCode, gs_userName, gs_wareCode,
        gs_classCode, gs_groupCode, gs_workdate, gs_userCode,
        operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
    } = global;
    const BASE_URL = gsURL;

    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(false);
    const [txtSN, setTxtSN] = useState("");
    const [f_returnCode, setFReturnCode] = useState("");
    const [itemList, setItemList] = useState<any[]>([]);
    const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
    const [label_error, setLabelError] = useState("");
    const scanTimer = useRef<any>(null);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        const loadToken = async () => {
            const t = await AsyncStorage.getItem("userToken");
            if (t) setToken(t);
        };
        loadToken();
        const timer = setTimeout(() => inputRef.current?.focus(), 100);
        return () => clearTimeout(timer);
    }, []);


    const handleBlur = () => {
        if (!loading) {
            setTimeout(() => inputRef.current?.focus(), 500);
        }
    };

    const getType = async (SN: string) => {
        try {
            const response = await fetch(`${BASE_URL}/api/BarcodeType`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode, scanCode: SN
                }),
            });
            const result = await response.json();
            if (result.message === "success" && result.data) {
                return result.data.scanType || "";
            }
            return "";
        } catch (err) {
            return "";
        }
    };

    const SNReturnGetNo = async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/SNReturn/GetNo`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    BillType: "RT"
                }),
            });

            const result = await response.json();
            if (result.code === 500) {
                Alert.alert("Error", result.message);
                return;
            }
            console.log("BillTyperesult", result)
            if (result.message === "success" && result.data) {
                return result.data.returnCode || result.data;
            }
            return "";
        } catch (err) {
            return "";
        }
    };

    const handleTextChange = (text: string) => {
        if (text.endsWith('\n') || text.endsWith('\r')) {
            const cleanSn = text.toUpperCase().trim();
            if (cleanSn.length > 0) {
                clearTimeout(scanTimer.current);
                //txtSN_KeyDown(cleanSn);
            }
            return;
        }

        setTxtSN(text);
        clearTimeout(scanTimer.current);

        if (text.trim().length > 0) {
            scanTimer.current = setTimeout(() => {
                const cleanSn = text.toUpperCase().trim();
                if (cleanSn.length > 0) {
                    txtSN_KeyDown(cleanSn);
                }
            }, 400);
        }
    };

    const txtSN_KeyDown = async (manualText?: string) => {
        const SN = (manualText || txtSN).toUpperCase().trim();
        if (!SN) return;

        setLabelError("");
        setLoading(true);
        setTxtSN("");

        try {
            let scanType = await getType(SN);
            //delet it after
            if (scanType === "") { scanType = "pallet" }

            if (scanType === "pallet" || scanType === "box" || scanType === "sn") {
                await SNDeal(SN, scanType);
            } else {
                setLabelError("Must Scan Pallet/Box/SN!");
            }
        } catch (err: any) {
            setLabelError(err.message);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const SNDeal = async (SN: string, scanType: string) => {
        let currentReturnCode = f_returnCode;

        // If return code is empty, generate a new one
        if (!currentReturnCode) {
            currentReturnCode = await SNReturnGetNo();
            if (!currentReturnCode) {
                setLabelError("Failed to generate Return Order ID");
                return;
            }
            setFReturnCode(currentReturnCode);
        }

        try {
            const response = await fetch(`${BASE_URL}/api/SNReturn/OneNew`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                    factoryCode: gs_factoryCode,
                    returnCode: currentReturnCode,
                    wareHouseCode: gs_wareCode,
                    barCode: SN,
                    scanType: scanType,
                    workdate: gs_workdate,
                    createUser: gs_userCode
                }),
            });

            const result = await response.json();
            if (result.code === 500) {
                Alert.alert("Error", result.message);
                return;
            }

            if (result.message === "success" && result.data) {
                const data = result.data;
                if (data.length > 0) {
                    if (data[0].isok === "1") {
                        setItemList(data);
                    } else {
                        setLabelError(data[0].retstr || "Scan Processing Failed");
                    }
                }
            } else {
                setLabelError("Data handling exceptions, please check!");
            }
        } catch (err: any) {
            setLabelError(err.message);
        }
    };

    const btnSNmx_Click = async () => {
        if (!f_returnCode) return;

        if (itemList.length <= 0) {
            setLabelError("You need Scan SN first!");
            return;
        }

        Alert.alert(
            "Confirm",
            `Are you Sure This ${itemList.length} SN In Warehouse?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const response = await fetch(`${BASE_URL}/api/SNReturn/InsertAll`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({
                                    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
                                    returnCode: f_returnCode,
                                    classesCode: gs_classCode,
                                    groupCode: gs_groupCode
                                }),
                            });

                            const result = await response.json();
                            if (result.code === 500) {
                                Alert.alert("Error", result.message);

                                return;
                            }
                            if (result.message === "success") {
                                // Clear state for next scan sequence
                                setFReturnCode("");
                                setItemList([]);
                                setLabelError("This Order in Warehouse, Scan Next!");
                                setTxtSN("");
                            } else {
                                setLabelError(result.data || "Confirmation failed");
                            }
                        } catch (err: any) {
                            setLabelError(err.message);
                        } finally {
                            setLoading(false);
                            inputRef.current?.focus();
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} id="button_exit">
                        <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>SNReturn</Text>
                </View>
                <View style={styles.headerRight}>
                    <Text style={styles.userNameText}>{gs_userName}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.inputSection}>


                    <View style={[styles.scanInputContainer, { marginBottom: 8 }]}>
                        <TextInput
                            ref={inputRef}
                            id="txtSN"
                            style={styles.scanInput}
                            placeholder="Scan Pallet/Box/SN..."
                            value={txtSN}
                            onChangeText={handleTextChange}
                            onSubmitEditing={() => txtSN_KeyDown()}
                            blurOnSubmit={false}
                            onBlur={handleBlur}
                            autoFocus={true}
                            showSoftInputOnFocus={false}
                            placeholderTextColor="#1E293B"
                            selectTextOnFocus={true}
                        />
                    </View>

                    <LinearGradient
                        colors={['#0052cc', '#0052cc']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.infoInputContainer, { marginBottom: 8 }]}
                    >
                        <Text style={styles.infoInputLabel}>Order </Text>
                        <TextInput
                            style={styles.infoInput}
                            value={f_returnCode}
                            editable={false}
                            placeholder="Generate on scan..."
                        />
                    </LinearGradient>

                    <LinearGradient
                        colors={['#0052cc', '#0052cc']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.infoInputContainer}
                    >
                        <Text style={styles.infoInputLabel}>QTY </Text>
                        <TextInput
                            style={styles.infoInput}
                            value={itemList.length.toString()}
                            editable={false}
                        />
                    </LinearGradient>
                </View>

                {label_error ? (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorText}>{label_error}</Text>
                    </View>
                ) : null}

                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.headerCell, { width: 140 }]}>SN</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>boxCode</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>palletCode</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>model</Text>
                                <Text style={[styles.headerCell, { width: 100 }]}>color</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>imeicode1</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>imeicode2</Text>
                                <Text style={[styles.headerCell, { width: 130 }]}>imeicode3</Text>
                                <Text style={[styles.headerCell, { width: 150 }]}>createDate</Text>
                            </View>
                            <ScrollView style={{ flex: 1 }}>
                                {loading ? (
                                    <View style={{ width: 1210, marginTop: 40 }}>
                                        <ActivityIndicator size="large" color="#0052cc" />
                                    </View>
                                ) : itemList.length === 0 ? (
                                    <View style={{ width: 1210, padding: 40 }}>
                                        <Text style={styles.emptyText}>Waiting for scanning...</Text>
                                    </View>
                                ) : (
                                    itemList.map((item, index) => (
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
                                            <Text style={[styles.cell, { width: 140 }]}>{item.sn}</Text>
                                            <Text style={[styles.cell, { width: 150 }]}>{item.boxCode}</Text>
                                            <Text style={[styles.cell, { width: 150 }]}>{item.palletCode}</Text>
                                            <Text style={[styles.cell, { width: 130 }]}>{item.model}</Text>
                                            <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
                                            <Text style={[styles.cell, { width: 130 }]}>{item.imeicode1}</Text>
                                            <Text style={[styles.cell, { width: 130 }]}>{item.imeicode2}</Text>
                                            <Text style={[styles.cell, { width: 130 }]}>{item.imeicode3}</Text>
                                            <Text style={[styles.cell, { width: 150 }]}>{item.createDate}</Text>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity
                        id="btnSNmx"
                        style={[styles.confirmBtn, (!f_returnCode || itemList.length === 0) && styles.disabledBtn]}
                        onPress={btnSNmx_Click}
                        disabled={!f_returnCode || itemList.length === 0 || loading}
                    >
                        <Text style={styles.confirmBtnText}>Confirm All</Text>
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
    inputSection: { marginBottom: 8 },
    scanInputContainer: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, height: 40, alignItems: 'center', elevation: 2, borderWidth: 1, borderColor: '#0052cc' },
    scanInput: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1E293B' },
    infoInputContainer: { flexDirection: 'row', backgroundColor: '#0052cc', borderRadius: 10, paddingHorizontal: 12, height: 40, alignItems: 'center', justifyContent: 'space-between', elevation: 2 },
    infoInputLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    infoInput: { flex: 1, fontSize: 13, fontWeight: '800', color: '#FFFFFF', textAlign: 'right' },
    errorBanner: { backgroundColor: '#FEE2E2', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#FECACA' },
    errorText: { fontSize: 12, fontWeight: '700', color: '#B91C1C' },
    tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 12, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#E2E8F0" },
    tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 8 },
    headerCell: { fontSize: 10, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
    tableRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
    cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600", paddingHorizontal: 4 },
    selectedRow: { backgroundColor: "#ffc3c3ff" },
    emptyText: { textAlign: "center", color: "#94A3B8", fontStyle: "italic" },
    footer: { marginTop: 8 },
    qtyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    qtyLabel: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    qtyValue: { fontSize: 16, fontWeight: '900', color: '#0052cc' },
    confirmBtn: { backgroundColor: "#0052cc", padding: 12, borderRadius: 10, alignItems: "center", height: 44, elevation: 2 },
    confirmBtnText: { color: "#FFF", fontWeight: "900", fontSize: 14 },
    disabledBtn: { opacity: 0.6 },
});
